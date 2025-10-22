const ImageKit = require('imagekit');

// Initialize ImageKit client
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Function to upload image to ImageKit
const uploadImage = async ({ file, filename }) => {
  try {
    const response = await imagekit.upload({
      file,
      folder: "/marketPlace/",
      fileName: filename || `image_${Date.now()}`,
    });
    return response;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
};

const deleteImage = async (fileId) => {
  try {
    const response = await imagekit.deleteFile(fileId);
    return response;
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

module.exports = {
  uploadImage,
  deleteImage,
};
