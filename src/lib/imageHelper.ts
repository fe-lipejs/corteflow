import heic2any from 'heic2any';

export async function processFileIfHeic(file: File): Promise<File> {
  const isHeic = file.type === 'image/heic' || 
                 file.type === 'image/heif' || 
                 file.name.toLowerCase().endsWith('.heic') || 
                 file.name.toLowerCase().endsWith('.heif');
                 
  if (!isHeic) {
    return file;
  }

  try {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.8,
    });
    
    // heic2any can return an array of Blobs if it's an animation, we take the first
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
    
    let newName = file.name;
    if (newName.toLowerCase().endsWith('.heic')) {
      newName = newName.replace(/\.heic$/i, '.jpg');
    } else if (newName.toLowerCase().endsWith('.heif')) {
      newName = newName.replace(/\.heif$/i, '.jpg');
    } else {
      newName = `${newName}.jpg`;
    }
    
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch (error) {
    console.error('Failed to convert HEIC image:', error);
    // Return original and hope for the best if conversion fails
    return file;
  }
}
