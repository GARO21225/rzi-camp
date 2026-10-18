// Compression d'une photo (File) → base64 JPEG SANS préfixe « data: » (format attendu par l'API).
export function compressImage(file, maxSizeKB = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')) }
    img.onload = () => {
      const maxDim = 1200
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      let q = 0.85
      let b64 = canvas.toDataURL('image/jpeg', q).split(',')[1]
      while (b64.length > maxSizeKB * 1024 && q > 0.3) { q -= 0.1; b64 = canvas.toDataURL('image/jpeg', q).split(',')[1] }
      URL.revokeObjectURL(url)
      resolve(b64)
    }
    img.src = url
  })
}
