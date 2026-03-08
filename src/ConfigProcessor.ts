type Timeline = {
	StartDate: string | null;
	EndDate: string | null;
};

type Project = {
	Timelines: Timeline[];
	StartDate?: string | null;
	EndDate?: string | null;
	Duration?: string;
	[key: string]: unknown;
};

type ProjectConfig = Record<string, Project>;

export function PostProcessProjectConfig(projectConfig: ProjectConfig): void {
	for (const projectKey of Object.keys(projectConfig)) {
		const project = projectConfig[projectKey];
		AddProjectStartEndDates(project);
		AddProjectDuration(project);
	}
}

function AddProjectStartEndDates(project: Project): void {
	let startDate = null;
	let endDate = null;
	let startDateStr: string | null = null;
	let endDateStr: string | null = null;

	for (const timeline of project.Timelines) {
		let timelineStartDate = new Date(timeline.StartDate!);
		let timelineEndDate = new Date(timeline.EndDate!);

		if (timeline.EndDate === "Current") {
			timelineEndDate = new Date();
			endDate = new Date();
			endDateStr = "Current";
		}

		if (Number.isNaN(timelineStartDate.getTime()) || Number.isNaN(timelineEndDate.getTime())) {
			continue;
		}

		if (timeline.StartDate != null) {
			if (startDate == null || timelineStartDate < startDate) {
				startDate = timelineStartDate;
				startDateStr = timeline.StartDate;
			}

			if (endDate == null || (timelineStartDate > endDate && endDateStr !== "Current")) {
				endDate = timelineStartDate;
				endDateStr = timeline.StartDate;
			}
		}

		if (timeline.EndDate != null && (endDate == null || (timelineEndDate > endDate && endDateStr !== "Current"))) {
			endDate = timelineStartDate;
			endDateStr = timeline.EndDate;
		}
	}

	project.StartDate = startDateStr;
	project.EndDate = endDateStr;
}

function AddProjectDuration(project: Project): void {
	let duration: number | null = null;

	for (const timeline of project.Timelines) {
		let timelineStartDate = new Date(timeline.StartDate!);
		let timelineEndDate = new Date(timeline.EndDate!);

		if (timeline.EndDate === "Current") {
			timelineEndDate = new Date();
		}

		if (Number.isNaN(timelineStartDate.getTime()) || Number.isNaN(timelineEndDate.getTime())) {
			continue;
		}

		const timelineDuration = timelineEndDate.getTime() - timelineStartDate.getTime();

		if (timelineDuration <= 0) {
			continue;
		}

		if (duration == null) {
			duration = 0;
		}

		duration += timelineDuration;
	}

	if (duration == null) {
		let startDate = new Date(project.StartDate!);
		let endDate = new Date(project.EndDate!);

		if (project.EndDate === "Current") {
			endDate = new Date();
		}

		if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
			return;
		}

		duration = endDate.getTime() - startDate.getTime();
	}

	if (duration <= 0) {
		return;
	}

	project.Duration = FormatDurationStr(duration);
}

function FormatDurationStr(duration: number): string {
	let days = duration / (1000 * 60 * 60 * 24);
	let weeks = days / 7;
	let months = days / 30;
	let years = days / 365;

	years = Math.round(years * 2) / 2;
	months = Math.round(months);
	weeks = Math.round(weeks);
	days = Math.round(days);

	if (years === 1) return years + " Year";
	if (years >= 1) return years + " Years";
	if (months === 1) return months + " Month";
	if (months >= 1) return months + " Months";
	if (weeks === 1) return weeks + " Week";
	if (weeks >= 1) return weeks + " Weeks";
	if (days === 1) return days + " Day";
	return days + " Days";
}
