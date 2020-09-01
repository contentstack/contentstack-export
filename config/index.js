module.exports = {
  master_locale: {
    // master locale of the stack
    name: 'English - United States',
    code: 'en-us'
  },
  // Credentials
  email: process.env.CONTENTSTACK_EMAIL,   // (optional)
  password: process.env.CONTENTSTACK_PASSWORD, // (optional)
  // Stack API KEY
  source_stack: process.env.CONTENTSTACK_STACK_API_KEY,             // mandatory
  access_token: process.env.CONTENTSTACK_ACCESS_TOKEN,
  management_token: process.env.CONTENTSTACK_MANAGEMENT_TOKEN,    
  // Path where the exported data will be stored (relative path)
  data: './contents'
};