import { Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Dialog, Field, useToast } from '../ui';

export function PlanShareDialog({
  inviteCode,
  link,
  onClose,
}: {
  inviteCode: string;
  link: string;
  onClose: () => void;
}) {
  const toast = useToast();
  return (
    <Dialog title="El plan empieza por invitar" onClose={onClose}>
      <p>Comparte el enlace o el código. Para entrar al grupo necesitarán su cuenta de QSale.</p>
      <div className="share-code">
        <QRCodeSVG value={link} size={180} title="Código QR para unirse al plan" />
        <strong>{inviteCode}</strong>
      </div>
      <Field label="Enlace de invitación" readOnly value={link} />
      <div className="actions end">
        <Button
          variant="secondary"
          onClick={() =>
            void navigator.clipboard
              .writeText(inviteCode)
              .then(() => toast('Código copiado.'))
              .catch(() => toast('Selecciona el código y cópialo manualmente.', true))
          }
        >
          <Copy size={17} />
          Copiar código
        </Button>
        <Button
          onClick={() =>
            void navigator.clipboard
              .writeText(link)
              .then(() => toast('Enlace copiado.'))
              .catch(() => toast('Selecciona el enlace y cópialo manualmente.', true))
          }
        >
          <Copy size={17} />
          Copiar enlace
        </Button>
      </div>
    </Dialog>
  );
}
