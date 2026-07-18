import { join } from "path";
import { readdirSync, statSync, readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import sharp from "sharp";
import * as sass from "sass";
import { RemoveExtension, TryMakeDir } from "./utils";

type GenericRecord = Record<string, any>;

export interface AssetConfig {
	ImageConfig: {
		HorizontalResolutionsGroups: number[];
		OutputFormats: string[];
	};
	VideoConfig: {
		HorizontalResolutionsGroups: number[];
		OutputFormats: string[];
	};
	NoCopyFolders: string[];
}

export class AssetProcessor {
	private readonly compress: boolean;
	private readonly onlyCopyNew: boolean;
	private readonly pathToRoot: string;
	private readonly rawStaticFolder: string;
	private readonly assetConfig: AssetConfig;

	constructor(
		compress: boolean,
		onlyCopyNew: boolean,
		pathToRoot: string,
		rawStaticFolder: string,
		assetConfig: AssetConfig
	) {
		this.compress = compress;
		this.onlyCopyNew = onlyCopyNew;
		this.pathToRoot = pathToRoot;
		this.rawStaticFolder = rawStaticFolder;
		this.assetConfig = assetConfig;
	}

	HandleFolder(inputPath: string, outputPath: string): void {
		if (this.isFolderToSkip(inputPath)) {
			console.log("⏭️  Skip folder: " + inputPath);
			return;
		}

		TryMakeDir(outputPath);

		const items = readdirSync(inputPath);

		for (const item of items) {
			const itemInputPath = join(inputPath, item);
			const itemOutputPath = join(outputPath, item);

			const stat = statSync(itemInputPath);
			if (stat.isFile()) {
				this.HandleFile(itemInputPath, itemOutputPath);
			} else {
				this.HandleFolder(itemInputPath, itemOutputPath);
			}
		}
	}

	private isFolderToSkip(folderPath: string): boolean {
		let pathStart = join(this.pathToRoot, this.rawStaticFolder) + "/";
		let removedFront = folderPath.replace(pathStart, "").replace(/\\/g, "/");
		return this.assetConfig.NoCopyFolders.includes(removedFront);
	}

	HandleFile(itemInputPath: string, itemOutputPath: string): void {
		if (itemInputPath.endsWith(".png") || itemInputPath.endsWith(".jpg")) {
			this.compressImage(itemInputPath, itemOutputPath);
		} else if (itemInputPath.endsWith(".mp4")) {
			this.compressVideo(itemInputPath, itemOutputPath);
		} else if (this.compress && itemInputPath.endsWith(".js")) {
			this.processTextFile(itemInputPath, itemOutputPath, CompressJs);
		} else if (this.compress && itemInputPath.endsWith(".css")) {
			this.processTextFile(itemInputPath, itemOutputPath, CompressCss);
		} else if (itemInputPath.endsWith(".scss")) {
			itemOutputPath = RemoveExtension(itemOutputPath) + ".css";
			const result = sass.compile(itemInputPath);
			writeFileSync(itemOutputPath, result.css);
			if (this.compress) {
				this.processTextFile(itemOutputPath, itemOutputPath, CompressCss);
			}
		} else if (itemInputPath.endsWith(".ejs") || itemInputPath.endsWith(".html")) {
			// Skip template files
		} else {
			this.copyFile(itemInputPath, itemOutputPath);
		}
	}

	private processTextFile(
		inputPath: string,
		outputPath: string,
		compressorFunc: (text: string) => string
	): void {
		const data = readFileSync(inputPath, "utf-8");
		const compressed = compressorFunc(data);
		writeFileSync(outputPath, compressed);
	}

	private compressImage(inputPath: string, outputPath: string): void {
		const noExtensionPath = RemoveExtension(outputPath);
		const imageConfig = this.assetConfig.ImageConfig;
		const imageFormats = imageConfig.OutputFormats;
		const horizontalResGroups = imageConfig.HorizontalResolutionsGroups;

		const outputFilePath = `${noExtensionPath}_${horizontalResGroups[0]}.${imageFormats[0]}`;

		if (existsSync(outputFilePath) && this.onlyCopyNew) {
			return;
		}

		sharp(inputPath)
			.metadata()
			.then((metadata: any) => {
				if (metadata.width == null) return;

				for (let f = 0; f < imageFormats.length; f++) {
					let width = metadata.width;
					let outputRezIndex = horizontalResGroups.length - 1;

					while (width < horizontalResGroups[outputRezIndex]) {
						const outputPath = `${noExtensionPath}_${horizontalResGroups[outputRezIndex]}.${imageFormats[f]}`;
						sharp(inputPath).toFile(outputPath).catch((error: unknown) => {
							console.error("Image Convert Error:", error);
						});
						outputRezIndex -= 1;
					}

					let newWidth = width;
					while (outputRezIndex >= 0) {
						if (newWidth < horizontalResGroups[outputRezIndex]) {
							const outputPath = `${noExtensionPath}_${horizontalResGroups[outputRezIndex]}.${imageFormats[f]}`;
							sharp(inputPath).resize(width).toFile(outputPath).catch((error: unknown) => {
								console.error("Image Convert Error:", error);
							});
							width = newWidth;
							outputRezIndex -= 1;
						} else {
							width = newWidth;
							newWidth = Math.round(newWidth * 0.5);
						}
					}
				}
			});
	}

	private compressVideo(inputPath: string, outputPath: string): void {
		// Video compression disabled - just copy
		this.copyFile(inputPath, outputPath);
	}

	private copyFile(inputPath: string, outputPath: string): void {
		try {
			copyFileSync(inputPath, outputPath);
		} catch (error) {
			console.error("File copy error:", error);
		}
	}
}

// Compression utilities
export function CompressHtml(text: string): string {
	return text
		.replace(/<!--([\s\S]*?)-->/g, "")
		.replace(/[.]\r?\n/gm, ". ")
		.replace(/[,]\r?\n/gm, ", ")
		.replace(/[\r\n]/gm, "")
		.replace(/\t/g, "");
}

function CompressCss(text: string): string {
	return text
		.replace(/\/\*.+?\*\//g, "")
		.replace(/[\r\n]/g, "")
		.replace(/\t/g, "")
	// .replace(/ /g, "");
}

function CompressJs(text: string): string {
	return text
		.replace(/((?:\/\*(?:[^*]|(?:\*+[^*\/]))*\*+\/)|(?:\/\/.*))/g, "")
		.replace(/[\r\n]/gm, " ")
		.replace(/\t/g, "");
}
