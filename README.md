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
 email: '', // Your registered email id
 password: '', // Account password
 source_stack: '' // Stack api_key
 access_token: '' // Stack access_token
 management_token: '' //Stack management_token
 data: '' // Relative path to the directory, where exported data is to be stored. ex: './contents'
 ...
}
```
    
## Usage
After setting the configuration, you'll can run the below given commands!

1. Export all modules [ assets, locales, environments, extensions, webhooks, global_fields, content_types and entries, labels ]

```bash
$ npm run export
```
  
2. Export a specific module
```bash
$ npm run export-assets
$ npm run export-env
$ npm run export-locales
$ npm run export-extensions
$ npm run export-webhooks
$ npm run export-globalfields
$ npm run export-contenttypes
$ npm run export-entries
$ npm run export-labels

```
> Note: Before exporting entries, you must export locales, assets and content types.

> Note: If you keep the value of preserveStackVersion to true, then you will have to provide the email and password mandatorily in the config file, the management token will not work in that case.

### Known Limitations and Issues
* If 2 assets share same uid and filename, only the first version of the asset would be available
* Does not support the following
	* Roles
	* Users
	* Releases
    * Workflow

## License
This project is licensed under MIT license
