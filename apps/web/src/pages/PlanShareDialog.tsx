import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button, Dialog, Field, useToast } from "../ui";

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
  const copy = async (text: string, message: string) => {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast("Selecciona el código o el enlace y cópialo manualmente.", true);
    }
  };
  return (
    <Dialog title="Compartir invitación" onClose={onClose}>
      <p>
        Comparte el enlace o el código. Para unirse necesitarán entrar o crear
        una cuenta de QSale. Unirse al grupo no confirma la asistencia.
      </p>
      <div className="share-code">
        <QRCodeSVG
          value={link}
          size={180}
          title="Código QR para unirse al plan"
        />
        <strong>{inviteCode}</strong>
      </div>
      <Field label="Enlace de invitación" readOnly value={link} />
      <div className="actions end">
        <Button
          variant="secondary"
          onClick={() => void copy(inviteCode, "Código copiado")}
        >
          <Copy size={17} />
          Copiar código
        </Button>
        <Button onClick={() => void copy(link, "Enlace copiado")}>
          <Copy size={17} />
          Copiar enlace
        </Button>
      </div>
    </Dialog>
  );
}
