/**
 * Extract text / data from attached files in browser (Images, PDFs, Text, Docs)
 */
export async function processAttachedFile(file) {
  return new Promise((resolve) => {
    const fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      previewUrl: null,
      extractedText: '',
      dataUrl: null,
    };

    if (file.type.startsWith('image/')) {
      fileInfo.previewUrl = URL.createObjectURL(file);
      const reader = new FileReader();
      reader.onload = () => {
        fileInfo.dataUrl = reader.result;
        resolve(fileInfo);
      };
      reader.onerror = () => resolve(fileInfo);
      reader.readAsDataURL(file);
      return;
    }

    if (
      file.type.includes('text') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.rtf')
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        fileInfo.extractedText = typeof reader.result === 'string' ? reader.result : '';
        resolve(fileInfo);
      };
      reader.onerror = () => resolve(fileInfo);
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result;
        const bytes = new Uint8Array(buffer);
        let text = '';
        let chunk = '';
        for (let i = 0; i < bytes.length && text.length < 20000; i++) {
          const byte = bytes[i];
          if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
            chunk += String.fromCharCode(byte);
            if (chunk.length > 500) {
              text += chunk;
              chunk = '';
            }
          } else if (chunk.length > 3) {
            text += chunk + ' ';
            chunk = '';
          } else {
            chunk = '';
          }
        }
        text += chunk;
        const cleanWords = text
          .split(/\s+/)
          .filter((w) => w.length < 45 && !/[\\/]{3,}/.test(w))
          .join(' ');

        fileInfo.extractedText = cleanWords.slice(0, 15000);
      } catch {
        fileInfo.extractedText = `Attached document: ${file.name}`;
      }

      const dataReader = new FileReader();
      dataReader.onload = () => {
        fileInfo.dataUrl = dataReader.result;
        resolve(fileInfo);
      };
      dataReader.onerror = () => resolve(fileInfo);
      dataReader.readAsDataURL(file);
    };
    reader.onerror = () => resolve(fileInfo);
    reader.readAsArrayBuffer(file);
  });
}
