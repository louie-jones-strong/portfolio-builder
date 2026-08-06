#!/usr/bin/env bun

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { PortfolioBuilder } from "./src/PortfolioBuilder";
import { runTextLinting } from "./src/TextLinter";
import { Logger } from "./src/logger";

const logger = new Logger({
	consoleMinLevel: "info",
	fileMinLevel: "debug",
});

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
		logger.error(`Config file not found: ${path}`);
		logger.error("Make sure your config directory contains all required files.");
		process.exit(1);
	}
	return JSON.parse(readFileSync(path, "utf-8"));
}

async function main() {
	const config = parseCliArgs();

	// Resolve project root to absolute path
	const rootPath = join(process.cwd(), config.projectRoot!);
	const configDir = join(rootPath, config.configDir!);

	// Setup log file path for logger
	logger.setLogFilePath(join(rootPath, "portfolio-builder.log"));

	logger.info("Portfolio Builder");
	logger.info(`Project Root: ${rootPath}`);
	logger.info(`Config Dir: ${configDir}`);
	logger.info(`Mode: ${config.release ? "Release" : "Development"}`);
	logger.info(`Clean: ${config.clean ? "Yes" : "No"}`);
	logger.info(`Compress: ${config.compress ? "Yes" : "No"}`);
	logger.info(`Only New: ${config.onlyNew ? "Yes" : "No"}`);

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
			logger,
		});

		const startTime = performance.now();
		await builder.Build();
		const endTime = performance.now();
		logger.info(`Build completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
	} catch (error) {
		logger.error("Build failed", error);
		process.exit(1);
	}
}

main();
