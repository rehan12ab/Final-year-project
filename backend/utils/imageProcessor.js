import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

/**
 * Process and crop image to 500x500
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save processed image
 * @returns {Promise<string>} - Path to processed image
 */
export const processNotificationImage = async (inputPath, outputPath) => {
    try {
        await sharp(inputPath)
            .resize(500, 500, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 90 })
            .toFile(outputPath);

        // Delete original file if different from output
        if (inputPath !== outputPath && fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }

        return outputPath;
    } catch (error) {
        console.error('Image processing error:', error);
        throw new Error('Failed to process image');
    }
};

/**
 * Get image dimensions
 * @param {string} imagePath - Path to image
 * @returns {Promise<{width: number, height: number}>}
 */
export const getImageDimensions = async (imagePath) => {
    try {
        const metadata = await sharp(imagePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height
        };
    } catch (error) {
        console.error('Error getting image dimensions:', error);
        throw new Error('Failed to get image dimensions');
    }
};
