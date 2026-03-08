import { mkdirSync } from "fs";

export function TryMakeDir(dirPath: string): void {
	try {
		mkdirSync(dirPath, { recursive: true });
	} catch (err: unknown) {
		if (
			err instanceof Error &&
			"code" in err &&
			(err as NodeJS.ErrnoException).code !== "EEXIST" &&
			(err as NodeJS.ErrnoException).code !== "ENOENT"
		) {
			throw err;
		}
	}
}

export function RemoveExtension(filePath: string): string {
	const lastDotIndex = filePath.lastIndexOf(".");
	if (lastDotIndex >= 0) {
		return filePath.slice(0, lastDotIndex);
	}
	return filePath;
}

export function MakePathRelative(fullPath: string, rootPath: string): string {
	return fullPath.replace(rootPath, "");
}
