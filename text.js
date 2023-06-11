const cv = require('opencv4nodejs');
const enchant = require('enchant');
const pytesseract = require('node-tesseract-ocr');
const autocorrect = require('autocorrect');
const { createCanvas, loadImage } = require('canvas');

const d = enchant.Dict('en_US');
const spell = new autocorrect();

// Crop image by removing a number of pixels
function shrinkByPixels(im, pixels) {
  const h = im.rows;
  const w = im.cols;
  return im.getRegion(new cv.Rect(pixels, pixels, w - 2 * pixels, h - 2 * pixels));
}

// Adjust the gamma in an image by some factor
function adjustGamma(image, gamma = 1.0) {
  const invGamma = 1.0 / gamma;
  const table = new Array(256).fill().map((_, i) => Math.pow((i / 255.0), invGamma) * 255);
  return image.applyMatrix(table);
}

// Comparison function for sorting contours
function getContourPrecedence(contour, cols) {
  const toleranceFactor = 200;
  const origin = contour.boundingRect();
  return ((origin.y / toleranceFactor) * toleranceFactor) * cols + origin.x;
}

// Find all speech bubbles in the given comic page and return a list of their contours
function findSpeechBubbles(image) {
  // Convert image to gray scale
  const imageGray = image.bgrToGray();
  // Recognizes rectangular/circular bubbles, struggles with dark colored bubbles 
  const binary = imageGray.threshold(235, 255, cv.THRESH_BINARY);
  // Find contours and document their hierarchy for later
  const { contours, hierarchy } = binary.findContours(cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
  const contourMap = {};
  const finalContourList = [];

  contourMap = filterContoursBySize(contours);
  contourMap = filterContainingContours(contourMap, hierarchy);

  // Sort final contour list
  finalContourList.push(...Object.values(contourMap).sort((a, b) => getContourPrecedence(a, binary.cols) - getContourPrecedence(b, binary.cols)));

  return finalContourList;
}

function filterContoursBySize(contours) {
  const contourMap = {};

  for (let i = 0; i < contours.length; i++) {
    // Filter out speech bubble candidates with unreasonable size
    if (contours[i].area() < 120000 && contours[i].area() > 4000) {
      // Smooth out contours that were found
      const epsilon = 0.0025 * contours[i].arcLength(true);
      const approximatedContour = contours[i].approxPolyDP(epsilon, true);
      contourMap[i] = approximatedContour;
    }
  }

  return contourMap;
}

// Sometimes the contour algorithm identifies entire panels, which can contain speech bubbles already
// identified causing us to parse them twice via OCR. This method attempts to remove contours that 
// contain other speech bubble candidate contours completely inside of them.
function filterContainingContours(contourMap, hierarchy) {
  const contourKeys = Object.keys(contourMap);

  for (let i = 0; i < contourKeys.length; i++) {
    let currentIndex = contourKeys[i];
    while (hierarchy[0][currentIndex][3] > 0) {
      const parentIndex = hierarchy[0][currentIndex][3];
      if (contourMap[parentIndex]) {
        delete contourMap[parentIndex];
      }
      currentIndex = parentIndex;
    }
  }

  return contourMap;
}

// Given a list of contours, return a list of cropped images based on the bounding rectangles of the contours
function cropSpeechBubbles(image, contours, padding = 0) {
  const croppedImageList = [];
  contours.forEach((contour) => {
    const rect = contour.boundingRect();
    const [x, y, w, h] = [rect.x, rect.y, rect.width, rect.height];
    const croppedImage = image.getRegion(new cv.Rect(x - padding, y - padding, w + 2 * padding, h + 2 * padding));
    croppedImageList.push(croppedImage);
  });

  return croppedImageList;
}

// Process a line of text based on some "business" rules
function processScript(script) {
  // Some modern comics have this string on their cover page
  if (script.includes('COMICS.COM')) {
    return '';
  }

  // Tesseract sometimes picks up 'I' chars as '|'
  script = script.replace('|', 'I');
  // We want new lines to be spaces so we can treat each speech bubble as one line of text
  script = script.replace('\n', ' ');
  // Remove multiple spaces from our string
  script = script.split(' ').filter(Boolean).join(' ');

  for (let char of script) {
    // Comic books tend to be written in upper case, so we remove anything other than upper case chars
    if (!/[A-Z \-,.?!'"’0-9]/.test(char)) {
      script = script.replace(char, '');
    }
  }

  // This line removes "- " and concatenates words split on two lines
  // One notable edge case we don't handle here, hyphenated words split on two lines
  script = script.replace(/(?<!-) - /g, '');
  const words = script.split(' ');
  for (let i = 0; i < words.length; i++) {
    // Spellcheck all words
    if (!d.check(words[i])) {
      const alphaWord = words[i].replace(/[^A-Za-z]/g, '');
      if (alphaWord && !d.check(alphaWord)) {
        words[i] = spell(words[i].toLowerCase()).toUpperCase();
      }
    }
    // Remove single chars other than 'I' and 'A'
    if (words[i].length === 1 && !['I', 'A'].includes(words[i])) {
      words[i] = '';
    }
  }

  // Remove any duplicated spaces
  script = words.join(' ').replace(/\s+/g, ' ');
  const finalWords = script.split(' ');
  const final = finalWords.join(' ');

  // Remove all two char lines other than 'NO' and 'OK'
  if (final.length === 2 && !['NO', 'OK'].includes(script)) {
    return '';
  }

  return final;
}

// Apply the OCR engine to the given image and return the recognized script where illegitimate characters are filtered out
async function tesseract(image) {
  const { data, width, height } = image;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(data);
  ctx.putImageData(imageData, 0, 0);
  const imagePath = 'temp.png';
  await canvas.saveAsPNG(imagePath);

  const config = {
    lang: 'eng',
  };
  const script = await pytesseract.recognize(imagePath, config);

  return processScript(script);
}

async function segmentPage(imagePath, shouldShowImage = false) {
  try {
    const image = await loadImage(imagePath);
    const mat = cv.imread(imagePath);

    // Convert the image to gray scale and adjust gamma
    const gray = mat.bgrToGray();
    const gamma = adjustGamma(gray, 1.8);

    // Apply morphological operations to improve text recognition
    const kernel = new cv.Mat(3, 3, cv.CV_8U, 1);
    const dilate = gamma.dilate(kernel);
    const close = dilate.erode(kernel);

    // Find contours of speech bubbles in the image
    const contours = findSpeechBubbles(close);

    // Crop speech bubbles from the image and perform OCR on each
    const croppedImages = cropSpeechBubbles(mat, contours, 5);
    const scriptList = await Promise.all(croppedImages.map(tesseract));

    if (shouldShowImage) {
      cv.imshow('image', close);
      cv.waitKey();
      cv.destroyAllWindows();
    }

    return scriptList.filter(Boolean);
  } catch (error) {
    console.error('Error segmenting page:', error);
    return [];
  }
}

segmentPage('D:/College of Engineering Trivandrum/interships/book/r.png', true).then((scripts) => {
  console.log('Scripts:', scripts);
});
