# Contentstack export utility

Contentstack is a headless CMS with an API-first approach that puts content at the centre. It is designed to simplify the process of publication by separating code from content.

This utility helps you to export content from Contentstack. The content is exported in JSON format and stored in file system.

## Installation

Download this project and install all the modules using following command.

```bash
npm install
```

## Configuration

Update configuration details at config/index.js

```js
'master_locale': 
	{
		'name': <<your stack's master locale>>,  // ex: 'English - United States'
		'code': <<stack's master locale's code>> // ex: "en-us"
	}
'email': << your registered e-mail address >>
'password': << your account passwd >>
// OR 
'access_token': << your stack's access_token >> 
'source_stack': << stack's api key >>
'data': << location of the folder, where you'd want the exported content >> // ex: './_content'
  ```
    
## Usage
After setting the configuration, you'll can run the below given commands!

### Export all the modules
```bash
npm run export 
```
  
### Export specific module
```bash
npm run export assets
npm run export env
npm run export locales
npm run export contenttypes
npm run export entries
```
> Note: Before exporting entries, you must export locales, assets and content types.

### Known issues
* It will migrate only latest published version of entry.
* v0.0.2 does not support exporting Contentstack's Releases and Extensions

### Known issues
* It will migrate only latest published version of entry.

## License
This project is licensed under MIT license
