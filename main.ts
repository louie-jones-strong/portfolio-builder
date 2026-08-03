#!/usr/bin/env bun

import { parseArgs } from "util";
import { existsSync, readFileSync } from "fs";
import { dirname, isAbsolute, join } from "path";
import { execSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { PortfolioBuilder } from "./src/PortfolioBuilder";

interface CliConfig {
	projectRoot?: string;
	configDir?: string;
	release?: boolean;
	clean?: boolean;
	compress?: boolean;
	onlyNew?: boolean;
	skipLint?: boolean;
}

interface LintOverrides {
	textlintEnabled?: boolean;
	textlintConfigPath?: string;
	textlintIgnorePath?: string;
	textlintTarget?: string;
	valeEnabled?: boolean;
	valeConfigPath?: string;
	valeTarget?: string;
}


function parseCliArgs(): CliConfig {
	const args = process.argv.slice(2);

	const config: CliConfig = {
		projectRoot: "",
		configDir: "config",
		release: args.includes("--release"),
		clean: args.includes("--clean"),
		compress: args.includes("--compress"),
		onlyNew: args.includes("--only-new"),
		skipLint: args.includes("--skip-lint"),
	};

	// Check for --project-root
	const projectRootIndex = args.indexOf("--project-root");
	if (projectRootIndex !== -1 && args[projectRootIndex + 1]) {
		config.projectRoot = args[projectRootIndex + 1];
	}

	// Check for --config-dir
	const configDirIndex = args.indexOf("--config-dir");
	if (configDirIndex !== -1 && args[configDirIndex + 1]) {
		config.configDir = args[configDirIndex + 1];
	}

	// Release implies clean
	if (config.release) {
		config.clean = true;
		config.compress = true;
	}

	return config;
}

function loadJsonConfig(path: string): any {
	if (!existsSync(path)) {
		console.error("Config file not found:", path);
		console.error("Make sure your config directory contains all required files.");
		process.exit(1);
	}
	return JSON.parse(readFileSync(path, "utf-8"));
}

function resolveBinCommand(packageRoot: string, binName: string): string {
	const require = createRequire(import.meta.url);

	if (binName === "textlint") {
		try {
			const textlintBinPath = require.resolve("textlint/bin/textlint.js");
			return `"${process.execPath}" "${textlintBinPath}"`;
		} catch {
			// Fall through to other resolution strategies.
		}
	}

	if (binName === "vale") {
		try {
			const valePackageJsonPath = require.resolve("@jti/vale/package.json");
			const valeBinPath = join(dirname(valePackageJsonPath), "run.js");
			if (existsSync(valeBinPath)) {
				return `"${process.execPath}" "${valeBinPath}"`;
			}
		} catch {
			// Fall through to other resolution strategies.
		}
	}

	const binFileName = process.platform === "win32" ? `${binName}.cmd` : binName;
	const localBinPath = join(packageRoot, "node_modules", ".bin", binFileName);
	if (existsSync(localBinPath)) {
		return `"${localBinPath}"`;
	}
	return `bunx ${binName}`;
}

function loadLintOverrides(rootPath: string): LintOverrides {
	const overridesPath = join(rootPath, ".portfolio-builder", "lint-overrides.json");
	if (!existsSync(overridesPath)) {
		return {};
	}

	try {
		const raw = readFileSync(overridesPath, "utf-8");
		return JSON.parse(raw) as LintOverrides;
	} catch {
		throw new Error(`Invalid JSON in lint overrides file: ${overridesPath}`);
	}
}

function resolveProjectPath(rootPath: string, inputPath: string): string {
	return isAbsolute(inputPath) ? inputPath : join(rootPath, inputPath);
}

function runLintCommand(command: string, label: string, cwd: string): void {
	const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
	try {
		execSync(command, {
			cwd,
			stdio: "inherit",
			shell,
		});
	} catch (error: unknown) {
		const status = error && typeof error === "object" && "status" in error && typeof (error as { status?: unknown }).status === "number"
			? (error as { status: number }).status
			: "unknown";
		console.warn(`⚠️ ${label} reported issues. Continuing build${typeof status === "number" ? ` (exit code ${status})` : ""}.`);
	}
}

function runProseLint(rootPath: string, skipLint: boolean): void {
	if (skipLint) {
		console.log("⏭️  Skipping prose linting (--skip-lint)");
		return;
	}

	const packageRoot = dirname(fileURLToPath(import.meta.url));
	const bundledTextlintConfigPath = join(packageRoot, "lint-config", ".textlintrc.json");
	const bundledTextlintIgnorePath = join(packageRoot, "lint-config", ".textlintignore");
	const bundledValeConfigPath = join(packageRoot, "lint-config", ".vale.ini");
	const textlintCommand = resolveBinCommand(packageRoot, "textlint");
	const valeCommand = resolveBinCommand(packageRoot, "vale");
	const overrides = loadLintOverrides(rootPath);

	const localTextlintConfigPath = join(rootPath, ".textlintrc.json");
	const localTextlintIgnorePath = join(rootPath, ".textlintignore");
	const localValeConfigPath = join(rootPath, ".vale.ini");

	const textlintConfigPath = overrides.textlintConfigPath
		? resolveProjectPath(rootPath, overrides.textlintConfigPath)
		: existsSync(localTextlintConfigPath)
			? localTextlintConfigPath
			: bundledTextlintConfigPath;
	const textlintIgnorePath = overrides.textlintIgnorePath
		? resolveProjectPath(rootPath, overrides.textlintIgnorePath)
		: existsSync(localTextlintIgnorePath)
			? localTextlintIgnorePath
			: bundledTextlintIgnorePath;
	const valeConfigPath = overrides.valeConfigPath
		? resolveProjectPath(rootPath, overrides.valeConfigPath)
		: existsSync(localValeConfigPath)
			? localValeConfigPath
			: bundledValeConfigPath;

	const textlintTarget = overrides.textlintTarget ?? "**/*.{md,txt}";
	const valeTarget = overrides.valeTarget ?? ".";
	const textlintEnabled = overrides.textlintEnabled ?? true;
	const valeEnabled = overrides.valeEnabled ?? true;

	const textlintConfigExists = textlintEnabled && existsSync(textlintConfigPath);
	const valeConfigExists = valeEnabled && existsSync(valeConfigPath);

	if (!textlintConfigExists && !valeConfigExists) {
		console.log("ℹ️  No prose lint configuration available. Skipping prose lint.");
		return;
	}

	console.log();
	console.log("🔎 Running prose linting...");

	if (textlintConfigExists) {
		const textlintSource = textlintConfigPath === localTextlintConfigPath ? "project" : "bundled";
		console.log(`- Textlint config: ${textlintSource} (${textlintConfigPath})`);
		console.log(`- Textlint target: ${textlintTarget}`);
		runLintCommand(
			`${textlintCommand} "${textlintTarget}" --config "${textlintConfigPath}" --ignore-path "${textlintIgnorePath}"`,
			"Textlint",
			rootPath,
		);
	}

	if (valeConfigExists) {
		const valeSource = valeConfigPath === localValeConfigPath ? "project" : "bundled";
		console.log(`- Vale config: ${valeSource} (${valeConfigPath})`);
		console.log(`- Vale target: ${valeTarget}`);
		runLintCommand(
			`${valeCommand} "${valeTarget}" --config "${valeConfigPath}"`,
			"Vale",
			rootPath,
		);
	}
}

async function main() {
	const config = parseCliArgs();

	// Resolve project root to absolute path
	const rootPath = join(process.cwd(), config.projectRoot!);
	const configDir = join(rootPath, config.configDir!);

	console.log("Portfolio Builder");
	console.log("=".repeat(50));
	console.log("Project Root:", rootPath);
	console.log("Config Dir:", configDir);
	console.log("Mode:", config.release ? "Release" : "Development");
	console.log("Clean:", config.clean ? "Yes" : "No");
	console.log("Compress:", config.compress ? "Yes" : "No");
	console.log("Only New:", config.onlyNew ? "Yes" : "No");
	console.log("Prose Lint:", config.skipLint ? "Skip" : "Enabled");
	console.log("=".repeat(50));
	console.log();

	// Load configuration files
	try {
		runProseLint(rootPath, config.skipLint!);

		const siteConfig = loadJsonConfig(join(configDir, "Site.json"));
		const projectConfig = loadJsonConfig(join(configDir, "Projects.json"));
		const iconsConfig = loadJsonConfig(join(configDir, "Icons.json"));

		let cvConfig;
		const cvConfigPath = join(configDir, "CV.json");
		if (existsSync(cvConfigPath)) {
			cvConfig = loadJsonConfig(cvConfigPath);
		}

		// Create and run builder
		const builder = new PortfolioBuilder({
			isRelease: config.release!,
			cleanBuild: config.clean!,
			compress: config.compress!,
			onlyCopyNew: config.onlyNew!,
			pathToRoot: rootPath,
			rawViewsFolder: siteConfig.Raw_ViewsFolder,
			outputViewsFolder: siteConfig.Output_ViewsFolder,
			rawStaticFolder: siteConfig.Raw_StaticFolder,
			outputStaticFolder: siteConfig.Output_StaticFolder,
			siteConfig,
			projectConfig,
			iconsConfig,
			cvConfig,
		});

		const startTime = performance.now();
		await builder.Build();
		const endTime = performance.now();

		console.log();
		console.log("=".repeat(50));
		console.log(`✅ Build completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
		console.log("=".repeat(50));
	} catch (error) {
		console.error();
		console.error("❌ Build failed:");
		console.error(error);
		process.exit(1);
	}
}

main();
