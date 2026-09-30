export function saveAsFile(data: BlobPart, filename: string, mime = "application/pdf") {
  const blob = new Blob([data], { type: mime });
  const ie = window.navigator as Navigator & { msSaveOrOpenBlob?: (b: Blob, n: string) => void };
  if (ie.msSaveOrOpenBlob) {
    ie.msSaveOrOpenBlob(blob, filename);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2500);
}
