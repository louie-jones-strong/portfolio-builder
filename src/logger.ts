import { appendFileSync, writeFileSync } from "fs";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	data?: unknown;
}

export interface LoggerOptions {
	consoleMinLevel?: LogLevel;
	fileMinLevel?: LogLevel;
	logFilePath?: string;
}

export class Logger {
	private static readonly LEVEL_WEIGHTS: Record<LogLevel, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	};

	private consoleMinLevel: LogLevel;
	private fileMinLevel: LogLevel;
	private logFilePath?: string;

	constructor(options: LoggerOptions = {}) {
		this.consoleMinLevel = options.consoleMinLevel ?? 'info';
		this.fileMinLevel = options.fileMinLevel ?? 'debug';
		this.logFilePath = options.logFilePath;
		if (this.logFilePath) {
			this.clearLogFile();
		}
	}

	private clearLogFile(): void {
		if (this.logFilePath) {
			try {
				writeFileSync(this.logFilePath, "", "utf-8");
			} catch (error) {
				console.error(`⚠️ Failed to clear log file: ${this.logFilePath}`, error);
			}
		}
	}

	public setConsoleLogLevel(level: LogLevel): void {
		this.consoleMinLevel = level;
	}

	public setFileLogLevel(level: LogLevel): void {
		this.fileMinLevel = level;
	}

	public setLogFilePath(path: string): void {
		this.logFilePath = path;
		this.clearLogFile();
	}

	public debug(message: string, data?: unknown): void {
		this.log('debug', message, data);
	}

	public info(message: string, data?: unknown): void {
		this.log('info', message, data);
	}

	public warn(message: string, data?: unknown): void {
		this.log('warn', message, data);
	}

	public error(message: string, data?: unknown): void {
		this.log('error', message, data);
	}

	private log(level: LogLevel, message: string, data?: unknown): void {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			...(data !== undefined && { data }),
		};

		if (this.shouldLogConsole(level)) {
			this.outputToConsole(entry);
		}

		if (this.shouldLogFile(level)) {
			this.outputToFile(entry);
		}
	}

	private shouldLogConsole(level: LogLevel): boolean {
		return Logger.LEVEL_WEIGHTS[level] >= Logger.LEVEL_WEIGHTS[this.consoleMinLevel];
	}

	private shouldLogFile(level: LogLevel): boolean {
		return this.logFilePath !== undefined && Logger.LEVEL_WEIGHTS[level] >= Logger.LEVEL_WEIGHTS[this.fileMinLevel];
	}

	private outputToConsole(entry: LogEntry): void {

		switch (entry.level) {
			case 'debug':
				console.debug(entry.message);
				break;
			case 'info':
				console.info(entry.message);
				break;
			case 'warn':
				console.warn(entry.message);
				break;
			case 'error':
				console.error(entry.message);
				break;
		}
	}

	private outputToFile(entry: LogEntry): void {
		if (!this.logFilePath) {
			return;
		}
		const formattedLog = JSON.stringify(entry) + "\n";
		try {
			appendFileSync(this.logFilePath, formattedLog, "utf-8");
		} catch (error) {
			console.error(`⚠️ Failed to write to log file: ${this.logFilePath}`, error);
		}
	}
}