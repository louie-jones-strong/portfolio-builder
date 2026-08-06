import { join, dirname, basename } from "path";
import { renderFile } from "ejs";
import { statSync, writeFileSync } from "fs";
import { CompressHtml } from "./AssetProcessor";
import { MakePathRelative, TryMakeDir } from "./utils";
import { Logger } from "./logger";

type GenericRecord = Record<string, any>;

export interface TemplateConfig {
	isRelease: boolean;
	compress: boolean;
	pathToRoot: string;
	rawViewsFolder: string;
	outputViewsFolder: string;
	siteConfig: GenericRecord;
	projectConfig: GenericRecord;
	iconsConfig: GenericRecord;
	logger: Logger;
}

export class TemplateRenderer {
	private readonly config: TemplateConfig;

	constructor(config: TemplateConfig) {
		this.config = config;
	}

	async BuildPage(pagePath: string, pageData: GenericRecord): Promise<void> {
		const sourcePath = join(this.config.pathToRoot, this.config.rawViewsFolder, pagePath);
		const outputPath = join(this.config.pathToRoot, this.config.outputViewsFolder, pagePath);

		const sourceFilePath = sourcePath + ".ejs";
		const outputFilePath = outputPath + ".html";

		const stat = statSync(sourceFilePath);
		if (!stat.isFile()) {
			this.config.logger.error(`Cannot build folder: ${sourceFilePath}`);
			return;
		}

		TryMakeDir(dirname(outputFilePath));

		const pageName = basename(outputFilePath, ".html");
		const pageParent = dirname(pagePath);
		const count = pagePath.split("/").length - 1;
		const pathToRoot = "../".repeat(count);

		const renderData = {
			...pageData,
			PageData: {
				IsRelease: this.config.isRelease,
				PageName: pageName,
				PageParent: pageParent,
				PathToRoot: pathToRoot,
				SiteConfig: this.config.siteConfig,
				Projects: this.config.projectConfig,
				Icons: this.config.iconsConfig,
				CurrentDate: new Date().toISOString().slice(0, 10),
			},
		};

		await this.RenderFile(sourceFilePath, outputFilePath, renderData);
	}

	private async RenderFile(sourceFile: string, outputFile: string, data: GenericRecord): Promise<void> {
		this.config.logger.info(`${MakePathRelative(sourceFile, this.config.pathToRoot)} → ${MakePathRelative(outputFile, this.config.pathToRoot)}`);

		try {
			let html = await renderFile(sourceFile, data);

			if (this.config.compress) {
				html = CompressHtml(html);
			}

			writeFileSync(outputFile, html);
		} catch (error) {
			this.config.logger.error(`Render error: ${error}`);
		}
	}
}
