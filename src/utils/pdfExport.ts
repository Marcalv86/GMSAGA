import { Project, Chat } from '../types';

export const exportChronicleToPDF = async (
  project: Project,
  chat: Chat,
  setLoadingText: (text: string) => void
) => {
  setLoadingText('Cargando motor de maquetación de PDF...');
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas')
  ]);

  setLoadingText('Maquetando el Tomo del Destino para exportación...');
  const element = document.getElementById('chat-content');
  if (!element) {
    throw new Error('No se encontró el contenido del chat.');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#f4ece0'
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const totalPdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  let heightLeft = totalPdfHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalPdfHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = -(totalPdfHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalPdfHeight);
    heightLeft -= pageHeight;
  }

  const safeProjName = project.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeChatName = chat.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  pdf.save(`${safeProjName}_${safeChatName}.pdf`);

  // Export JSON backup as well
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', `${safeProjName}_backup.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};
