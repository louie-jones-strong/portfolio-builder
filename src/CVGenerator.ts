import { render } from "ejs";
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import puppeteer from "puppeteer-core";

type GenericRecord = Record<string, any>;

function findChromePath(): string | null {
	const candidates = [
		process.env.PUPPETEER_EXECUTABLE_PATH,
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/usr/bin/chromium-browser",
		"/usr/bin/chromium",
		"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	].filter(Boolean);

	for (const p of candidates) {
		if (p && existsSync(p)) return p;
	}
	return null;
}

export interface CVGeneratorConfig {
	cvConfig: GenericRecord;
	projectConfig: GenericRecord;
	siteConfig: GenericRecord;
	iconsConfig: GenericRecord;
	pathToRoot: string;
	templatePath: string;
	cssSourcePath: string;
	htmlOutputPath: string;
	pdfOutputPath: string;
}

export async function GenerateCV(config: CVGeneratorConfig): Promise<void> {
	// 1. Render EJS template
	const template = readFileSync(config.templatePath, "utf-8");

	const html = render(
		template,
		{
			CVConfig: config.cvConfig,
			Projects: config.projectConfig,
			Icons: config.iconsConfig,
			SiteConfig: config.siteConfig,
			CurrentDate: new Date().toISOString().slice(0, 10),
		},
		{ filename: config.templatePath }
	);

	// 2. Write HTML
	mkdirSync(dirname(config.htmlOutputPath), { recursive: true });
	writeFileSync(config.htmlOutputPath, html, "utf-8");
	console.log("  ✅ CV HTML:", config.htmlOutputPath);

	// 3. Copy CSS
	const cssOutputDir = join(dirname(config.htmlOutputPath), "Public", "css", "Optional");
	mkdirSync(cssOutputDir, { recursive: true });
	copyFileSync(config.cssSourcePath, join(cssOutputDir, "CV.css"));

	// 4. Generate PDF
	const executablePath = findChromePath();
	if (!executablePath) {
		console.warn("  ⚠️  No Chromium/Chrome found – skipping PDF generation");
		return;
	}

	const browser = await puppeteer.launch({
		executablePath,
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
	});

	try {
		const page = await browser.newPage();
		await page.goto("file://" + config.htmlOutputPath, { waitUntil: "networkidle0" });
		const pdfBuffer = await page.pdf({
			format: "A4",
			printBackground: true,
			margin: { top: "0", right: "0", bottom: "0", left: "0" },
		});
		writeFileSync(config.pdfOutputPath, pdfBuffer);
		console.log("  ✅ CV PDF:", config.pdfOutputPath);
	} finally {
		await browser.close();
	}
}
