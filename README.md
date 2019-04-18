# Contentstack Export Utility

Contentstack is a headless CMS with an API-first approach that puts content at the centre. It is designed to simplify the process of publication by separating code from content.

This utility helps you to export content from Contentstack. The data is exported in JSON format and stored in file system.

## Installation

Download this project and install all the modules using following command.

```bash
npm install
```

## Configuration

Update configuration details at config/index.js

```js
{
 master_locale: {
  name: '', // Stack's master locale. ex: 'English - United States'
  code: ''  // Stack master locale's code. ex: 'en-us'
 },
 source_stack: '' // Stack api_key
 access_token: '' // Stack access_token
 data: '' // Relative path to the directory, where exported data is to be stored. ex: './contents'
 ...
}
```
    
## Usage
After setting the configuration, you'll can run the below given commands!

1. Export all modules [ assets, locales, environments, content_types and entries ]

```bash
$ npm run export
```
  
2. Export a specific module
```bash
$ npm run export-assets
$ npm run export-env
$ npm run export-locales
$ npm run export-contenttypes
$ npm run export-entries
```
> Note: Before exporting entries, you must export locales, assets and content types.

### Known issues
* If 2 assets share same uid and filename, only the first version of the asset would be available
* The following contents are not supported
	* Roles
	* Users
	* Releases
    * Workflow

## License
This project is licensed under MIT license
