# Built.io Contentstack export tool

Built.io Contentstack is a headless CMS with an API-first approach that puts content at the centre. It is designed to simplify the process of publication by separating code from content.

This utility helps you to export content from Contentstack. The content is exported in JSON format and stored in file system.

## Installation

Download this project and install all the modules using following command.

```bash
npm install
```

## Configuration

Update configuration details at config/index.json :

```
"base_locale": {"name": <<YOUR MASTER LOCALE NAME>>, "code":<<YOUR MASTER LOCALE CODE>>}
"email": <<YOUR EMAIL ADDRESS>>
"password" : <<PASSWORD>>
"source_stack" : <<STACK_API_KEY>>
"data": <<FOLDER PATH WHERE DATA SHOULD BE EXPORTED>>
  ```
    
## Usage
  
After the configuration, you are ready to export content.

### Export all the modules :

  ```
  npm run export 
  ```
  
### Export specific module :
  
```
  npm run export <<module name>>
 ```
 
 Module names and sequence can be as follows:
 1. assets
 2. environments
 3. locales
 4. contentTypes
 5. entries
 
Note: Before exporting entries, you must export locales, assets and content types.

### Known issues
* Self/cyclic reference not supported
* For now only en-us as master language is supported
* Content type descriptions missing

## License
This project is licensed under MIT license
