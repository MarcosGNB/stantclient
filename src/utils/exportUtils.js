import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const exportComponent = async (elementId, format, fileName) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Better quality
      useCORS: true,
      backgroundColor: '#0f1115' // Match app background or use white for ticket
    });

    if (format === 'png') {
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `${fileName}.png`;
      link.click();
    } else if (format === 'pdf') {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'l' : 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${fileName}.pdf`);
    }
  } catch (err) {
    console.error('Export failed', err);
    alert('Error al exportar reporte');
  }
};
