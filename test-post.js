// test-post.js
const axios = require('axios');

const API_URL = 'http://192.168.1.90:3001/api/users';

const testUser = {
  user_id: 'xyz123',
  username: 'testuser',
  name: 'Test User',
  email: 'testuser@example.com'
};

axios.post(API_URL, testUser)
  .then(response => {
    console.log('✅ POST successful:', response.data);
  })
  .catch(error => {
    if (error.response) {
      console.error('❌ Server responded with error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ No response received:', error.request);
    } else {
      console.error('❌ Error setting up request:', error.message);
    }
  });
