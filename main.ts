#!/usr/bin/env bun

import { parseArgs } from "util";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { PortfolioBuilder } from "./src/PortfolioBuilder";

interface CliConfig {
	projectRoot?: string;
	configDir?: string;
	release?: boolean;
	clean?: boolean;
	compress?: boolean;
	onlyNew?: boolean;
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
	console.log("=".repeat(50));
	console.log();

	// Load configuration files
	try {
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
