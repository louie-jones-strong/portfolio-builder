import { join } from "path";
import { rmSync, existsSync } from "fs";
import { TemplateRenderer } from "./TemplateRenderer";
import { AssetProcessor } from "./AssetProcessor";
import { TryMakeDir } from "./utils";
import { PostProcessProjectConfig } from "./ConfigProcessor";
import { GenerateCV } from "./CVGenerator";

type GenericRecord = Record<string, any>;

export interface PortfolioConfig {
	isRelease: boolean;
	cleanBuild: boolean;
	compress: boolean;
	onlyCopyNew: boolean;
	pathToRoot: string;
	rawViewsFolder: string;
	outputViewsFolder: string;
	rawStaticFolder: string;
	outputStaticFolder: string;
	siteConfig: GenericRecord;
	projectConfig: GenericRecord;
	iconsConfig: GenericRecord;
	cvConfig?: GenericRecord;
}

export class PortfolioBuilder {
	private readonly config: PortfolioConfig;
	private readonly templateRenderer: TemplateRenderer;
	private readonly assetProcessor: AssetProcessor;

	constructor(config: PortfolioConfig) {
		this.config = config;

		// Post-process project config
		PostProcessProjectConfig(this.config.projectConfig);

		// Initialize processors
		this.templateRenderer = new TemplateRenderer({
			isRelease: config.isRelease,
			compress: config.compress,
			pathToRoot: config.pathToRoot,
			rawViewsFolder: config.rawViewsFolder,
			outputViewsFolder: config.outputViewsFolder,
			siteConfig: config.siteConfig,
			projectConfig: config.projectConfig,
			iconsConfig: config.iconsConfig,
		});

		this.assetProcessor = new AssetProcessor(
			config.compress,
			config.onlyCopyNew,
			config.pathToRoot,
			config.rawStaticFolder,
			config.siteConfig.AssetConfig
		);
	}

	async Build(): Promise<void> {
		if (this.config.cleanBuild) {
			console.log();
			console.log("🧹 Cleaning Output Folder...");
			const outputPath = join(this.config.pathToRoot, this.config.outputViewsFolder);
			if (existsSync(outputPath)) {
				rmSync(outputPath, { recursive: true });
			}
		}

		const outputPath = join(this.config.pathToRoot, this.config.outputViewsFolder);
		TryMakeDir(outputPath);

		// Generate CV if enabled
		if (this.config.cvConfig && this.config.siteConfig.ContactLinks?.CVDownloadAllowed) {
			await this.BuildCV();
		}

		// Build assets if static folder is not a subfolder of views
		if (!this.config.rawStaticFolder.includes(this.config.rawViewsFolder)) {
			this.BuildAssets();
		}

		// Build pages
		await this.BuildPages();

		// Copy non-EJS files from views folder
		this.CopyNonEJSFiles();
	}

	private async BuildCV(): Promise<void> {
		if (!this.config.cvConfig) {
			return;
		}

		console.log();
		console.log("📄 Generating CV...");

		const cvHtmlPath = join(this.config.pathToRoot, this.config.outputViewsFolder, "CV.html");
		const cvPdfPath = join(this.config.pathToRoot, this.config.outputViewsFolder, "CV.pdf");
		const templatePath = join(this.config.pathToRoot, this.config.rawViewsFolder, "CV.ejs");
		const cssSourcePath = join(
			this.config.pathToRoot,
			this.config.rawViewsFolder,
			"Public",
			"css",
			"Optional",
			"CV.css"
		);

		await GenerateCV({
			cvConfig: this.config.cvConfig,
			projectConfig: this.config.projectConfig,
			siteConfig: this.config.siteConfig,
			iconsConfig: this.config.iconsConfig,
			pathToRoot: this.config.pathToRoot,
			templatePath,
			cssSourcePath,
			htmlOutputPath: cvHtmlPath,
			pdfOutputPath: cvPdfPath,
		});
	}

	private BuildAssets(): void {
		console.log();
		console.log("🎨 Building Assets...");

		const sourcePath = join(this.config.pathToRoot, this.config.rawStaticFolder);
		const outputPath = join(this.config.pathToRoot, this.config.outputStaticFolder);

		this.assetProcessor.HandleFolder(sourcePath, outputPath);
	}

	private async BuildPages(): Promise<void> {
		console.log();
		console.log("📝 Building Pages...");

		// Build project pages
		for (const projectKey of Object.keys(this.config.projectConfig)) {
			const project = this.config.projectConfig[projectKey];
			const pagePath = project.PagePath;

			if (pagePath != null) {
				const pageData = { ProjectData: project };
				await this.templateRenderer.BuildPage(pagePath, pageData);
			}
		}
	}

	private CopyNonEJSFiles(): void {
		console.log();
		console.log("📋 Copying Non-EJS Files...");

		const sourcePath = join(this.config.pathToRoot, this.config.rawViewsFolder);
		const outputPath = join(this.config.pathToRoot, this.config.outputViewsFolder);

		this.assetProcessor.HandleFolder(sourcePath, outputPath);
	}
}
