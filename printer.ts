
import { Sale } from './types';

const ESC = 0x1B;
const GS = 0x1D;

export interface PrintCustomOptions {
  isPartial?: boolean;
  paidAmount?: number;
}

export class PrinterService {
  private device: any | null = null;
  private characteristic: any | null = null;

  private commonServices = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    'e7e11000-4f27-41d3-a9d8-61821b138fe0',
    '0000ae30-0000-1000-8000-00805f9b34fb',
    '0000af30-0000-1000-8000-00805f9b34fb',
    '0000fe01-0000-1000-8000-00805f9b34fb',
    '00001101-0000-1000-8000-00805f9b34fb',
    '00001800-0000-1000-8000-00805f9b34fb',
    '00001801-0000-1000-8000-00805f9b34fb'
  ];

  checkCompatibility(): { supported: boolean; secure: boolean; error?: string } {
    const supported = !!(navigator as any).bluetooth;
    const secure = window.isSecureContext;
    if (!supported) return { supported: false, secure, error: 'Navegador no compatible con Bluetooth.' };
    if (!secure) return { supported, secure: false, error: 'Requiere HTTPS para funcionar.' };
    return { supported: true, secure: true };
  }

  async connect(): Promise<{success: boolean, error?: string}> {
    try {
      const diag = this.checkCompatibility();
      if (!diag.supported || !diag.secure) throw new Error(diag.error);

      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.commonServices
      });

      const server = await this.device.gatt.connect();
      const services = await server.getPrimaryServices();

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          const writeChar = characteristics.find((c: any) => 
            c.properties.write || c.properties.writeWithoutResponse
          );
          
          if (writeChar) {
            this.characteristic = writeChar;
            return { success: true };
          }
        } catch (e) {
          continue;
        }
      }
      throw new Error('No se encontró canal de impresión.');
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  printViaSystem(sale: Sale, options?: PrintCustomOptions) {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;

    const itemsHtml = sale.items.map(item => `
      <div style="margin-bottom: 10px; border-bottom: 1px dashed #ccc; padding-bottom: 6px;">
        <div style="font-size: 22px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; line-height: 1.1;">${item.name}</div>
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold;">
          <span>${item.quantity} x $${Number(item.price).toFixed(2)}</span>
          <span>$${Number(item.subtotal).toFixed(2)}</span>
        </div>
      </div>
    `).join('');

    let footerHtml = `
      <div class="bold total" style="display: flex; justify-content: space-between;">
        <span>TOTAL:</span>
        <span>$${Number(sale.total).toFixed(2)}</span>
      </div>
    `;

    if (options?.isPartial && options.paidAmount !== undefined) {
      const remaining = Number(sale.total) - options.paidAmount;
      footerHtml += `
        <div style="margin-top:5px; border-top: 1px dashed #000; padding-top: 5px;">
           <div style="display: flex; justify-content: space-between; font-size: 16px;">
             <span>ABONADO:</span>
             <span>$${options.paidAmount.toFixed(2)}</span>
           </div>
           <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-top: 2px;">
             <span>RESTA:</span>
             <span>$${remaining.toFixed(2)}</span>
           </div>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', Courier, monospace; width: 58mm; margin: 0; padding: 5px; font-size: 14px; color: black; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .header { font-size: 24px; margin-bottom: 5px; letter-spacing: -1px; }
            .divider { border-top: 2px dashed #000; margin: 10px 0; }
            .total { font-size: 26px; margin-top: 15px; }
            .footer { margin-top: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            @media print { @page { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="center bold header">PAPELERA LC</div>
          <div class="center" style="font-size: 12px;">Ticket: #${sale.id.slice(0, 8).toUpperCase()}</div>
          <div class="center" style="font-size: 12px;">${new Date(sale.timestamp).toLocaleString()}</div>
          <div class="divider"></div>
          <div style="font-size: 14px; font-weight: bold;">Cliente: ${sale.customerName || 'Mostrador'}</div>
          <div class="divider"></div>
          ${itemsHtml}
          <div class="divider"></div>
          ${footerHtml}
          <div class="center footer">
            ¡GRACIAS POR CONFIAR<br>EN NOSOTROS!
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  generateEscPos(sale: Sale, options?: PrintCustomOptions): Uint8Array {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];

    const add = (data: number[] | Uint8Array | string) => {
      if (typeof data === 'string') {
        const cleanStr = data.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        chunks.push(encoder.encode(cleanStr));
      }
      else chunks.push(new Uint8Array(data));
    };

    // Header
    add([ESC, 0x40]); // Init
    add([ESC, 0x61, 0x01]); // Center
    add([GS, 0x21, 0x11]); // Double W+H for Title
    add([ESC, 0x45, 0x01]); // Bold
    add("PAPELERA LC\n");
    add([GS, 0x21, 0x00]); // Reset size
    add([ESC, 0x45, 0x00]); // Reset bold
    add("--------------------------------\n");
    add([ESC, 0x61, 0x00]); // Align Left
    add(`Ticket: #${sale.id.slice(0, 8).toUpperCase()}\n`);
    add(`Fecha: ${new Date(sale.timestamp).toLocaleString()}\n`);
    add("--------------------------------\n");

    sale.items.forEach(item => {
      // NOMBRE: Doble Altura + Bold
      add([ESC, 0x45, 0x01]); // Bold On
      add([GS, 0x21, 0x01]);  // Double Height
      add(`${item.name.toUpperCase()}\n`);
      
      // DETALLES (Precio/Cant): Doble Altura (sin Bold, para diferenciar pero mantener tamaño grande)
      add([ESC, 0x45, 0x00]); // Bold Off (o usar Bold para mas grosor si la impresora es tenue)
      // Mantengo Double Height activo del comando anterior, o lo reafirmo:
      add([GS, 0x21, 0x01]);  // Double Height
      
      const priceLine = `${item.quantity} x $${Number(item.price).toFixed(2)}`.padEnd(16) + `$${Number(item.subtotal).toFixed(2).padStart(10)}\n`;
      add(priceLine);
      
      // Reset para separador
      add([GS, 0x21, 0x00]); 
      add("\n"); 
    });

    add("--------------------------------\n");
    
    // TOTAL: Double Width + Double Height + Bold
    add([ESC, 0x61, 0x02]); // Align Right (o Center) -> Right looks better for totals usually but Center is safe
    add([ESC, 0x61, 0x01]); // Center for clarity
    add([GS, 0x21, 0x11]);  
    add([ESC, 0x45, 0x01]); 
    add(`TOTAL: $${Number(sale.total).toFixed(2)}\n`);
    
    // Si es pago parcial, agregar detalles
    if (options?.isPartial && options.paidAmount !== undefined) {
       const remaining = Number(sale.total) - options.paidAmount;
       // Resetear tamaños pero mantener algo legible
       add([GS, 0x21, 0x00]); 
       add([ESC, 0x45, 0x00]);
       add("--------------------------------\n"); // Separador fino
       
       add([ESC, 0x45, 0x01]); // Bold
       add(`ABONADO: $${options.paidAmount.toFixed(2)}\n`);
       
       add([GS, 0x21, 0x01]); // Double Height para el Saldo
       add(`RESTA:   $${remaining.toFixed(2)}\n`);
    }

    // Footer
    add([GS, 0x21, 0x00]);  
    add([ESC, 0x45, 0x00]); 
    add([ESC, 0x61, 0x01]); 
    add("\n¡GRACIAS POR CONFIAR\nEN NOSOTROS!\n");
    add("\n\n\n\n\n"); // Feed

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach(c => {
      result.set(c, offset);
      offset += c.length;
    });
    return result;
  }

  async print(sale: Sale, options?: PrintCustomOptions): Promise<{success: boolean, error?: string}> {
    if (!this.characteristic || !this.device?.gatt?.connected) {
      const conn = await this.connect();
      if (!conn.success) return conn;
    }

    try {
      const data = this.generateEscPos(sale, options);
      const chunkSize = 20; 
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await this.characteristic.writeValue(chunk);
      }
      return { success: true };
    } catch (error: any) {
      this.characteristic = null;
      return { success: false, error: 'Error al enviar datos.' };
    }
  }
}

export const printer = new PrinterService();
