// Firebase Storage Security Rules - BETA VERSION (OPEN ACCESS)
// Go to Firebase Console > Storage > Rules and paste this:

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // BETA: Allow anyone to read and write to posts folder
    match /posts/{userId}/{allPaths=**} {
      allow read, write: if true;
    }
    
    // BETA: Allow anyone to read and write to profile_images folder  
    match /profile_images/{allPaths=**} {
      allow read, write: if true;
    }
    
    // BETA: Allow anyone to read and write to communities folder
    match /communities/{allPaths=**} {
      allow read, write: if true;
    }
    
    // Allow all other paths for beta testing
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}

// IMPORTANT: 
// These rules are for BETA/DEVELOPMENT ONLY
// For production, you should implement proper authentication:
//
// match /posts/{userId}/{allPaths=**} {
//   allow read: if true;
//   allow write: if request.auth != null && request.auth.uid == userId;
// }