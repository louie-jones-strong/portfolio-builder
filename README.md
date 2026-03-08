# Portfolio Builder

⚡ Fast CLI tool for building static portfolio websites from EJS templates, powered by [Bun](https://bun.sh).

## Features

- 🚀 **Lightning Fast** - Uses Bun for native TypeScript execution
- 📦 **Asset Processing** - Automatic image optimization, SCSS compilation
- 🎨 **Template Engine** - EJS templates with flexible data binding
- 📄 **CV Generation** - Generate HTML and PDF CVs from templates
- 🧹 **Clean Builds** - Smart incremental and clean build modes
- 🗜️ **Compression** - Optional HTML/CSS/JS minification

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Chrome/Chromium (for PDF generation)

## Installation
```bash
# Using Bun
bun add @louie-jones-strong/portfolio-builder

# Using npm
npm install @louie-jones-strong/portfolio-builder
```

Then use the CLI:
```bash
bunx portfolio-builder
```


## Project Structure

Your portfolio project should have this structure:

```
your-portfolio/
├── config/              # Configuration files
│   ├── Site.json       # Site settings (required)
│   ├── Projects.json   # Project data (required)
│   ├── Icons.json      # Icon mappings (required)
│   └── CV.json         # CV data (optional)
├── raw_docs/           # Source templates
│   ├── index.ejs
│   ├── CV.ejs          # If using CV generation
│   └── Public/         # Static assets
│       ├── css/
│       ├── js/
│       └── Assets/
├── docs/               # Build output (generated)
└── build-tools/        # This tool (portfolio-builder)
```

## Configuration

### Site.json

```json
{
  "Raw_ViewsFolder": "raw_docs",
  "Output_ViewsFolder": "docs",
  "Raw_StaticFolder": "raw_docs/Public",
  "Output_StaticFolder": "docs/Public",
  "HostURL": "https://your-site.com/",
  "ContactLinks": {
    "CVDownloadAllowed": true,
    "Email": "you@example.com"
  },
  "AssetConfig": {
    "ImageConfig": {
      "HorizontalResolutionsGroups": [128, 256, 512, 1024],
      "OutputFormats": ["webp", "png"]
    },
    "VideoConfig": {
      "HorizontalResolutionsGroups": [1024],
      "OutputFormats": ["mp4"]
    },
    "NoCopyFolders": ["css/Shared"]
  }
}
```

### Projects.json

```json
{
  "Project1": {
    "Title": "My Project",
    "PagePath": "projects/my-project",
    "Thumbnail": "Public/Assets/project/thumb",
    "QuickDescription": "A cool project",
    "Timelines": [
      {
        "StartDate": "2024-01-01",
        "EndDate": "Current"
      }
    ],
    "Skills": ["TypeScript", "Bun"],
    "Links": []
  }
}
```

### Icons.json

```json
{
  "GitHub": "fab fa-github",
  "LinkedIn": "fab fa-linkedin",
  "TypeScript": "fab fa-js"
}
```


## How It Works

1. **Loads Configuration** - Reads your config files
2. **Post-processes Data** - Calculates project durations, dates, etc.
3. **Generates CV** (if enabled) - Creates HTML and PDF from template
4. **Processes Assets** - Optimizes images, compiles SCSS, copies files
5. **Renders Templates** - Converts EJS to HTML with your data
6. **Copies Static Files** - Handles robots.txt, etc.

## EJS Templates

Your EJS templates have access to:

```javascript
{
  PageData: {
    IsRelease: boolean,
    PageName: string,
    PageParent: string,
    PathToRoot: string,  // Relative path to root "../../../"
    SiteConfig: object,
    Projects: object,
    Icons: object,
    CurrentDate: string
  },
  ProjectData: object  // When rendering project pages
}
```

Example template:

```ejs
<!DOCTYPE html>
<html>
<head>
  <title><%= PageData.SiteConfig.SiteName %></title>
  <link rel="stylesheet" href="<%= PageData.PathToRoot %>Public/css/style.css">
</head>
<body>
  <h1><%= ProjectData.Title %></h1>
  <p><%= ProjectData.QuickDescription %></p>
</body>
</html>
```