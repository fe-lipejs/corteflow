/**
 * Gerador de perfil .mobileconfig (WebClip) para iOS (iPhone / iPad).
 * Permite ao usuário instalar o aplicativo diretamente na tela de início via perfil nativo do iOS.
 */

export interface MobileConfigOptions {
  title: string;
  url: string;
  iconBase64?: string; // PNG base64
  identifier?: string;
}

export function generateMobileConfigXML(options: MobileConfigOptions): string {
  const { title, url, iconBase64, identifier = 'com.raffros.app' } = options;
  const uuidPayload = 'b45d9472-3580-459f-9343-' + Math.random().toString(36).substring(2, 14);
  const uuidProfile = 'c72e1098-8421-4f81-a481-' + Math.random().toString(36).substring(2, 14);

  const iconXml = iconBase64
    ? `\n      <key>Icon</key>\n      <data>${iconBase64}</data>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadIdentifier</key>
      <string>${identifier}.webclip</string>
      <key>PayloadUUID</key>
      <string>${uuidPayload}</string>
      <key>PayloadDisplayName</key>
      <string>${title}</string>
      <key>PayloadDescription</key>
      <string>Adiciona o ${title} à tela inicial</string>
      <key>PayloadOrganization</key>
      <string>Raffros</string>
      <key>Label</key>
      <string>${title}</string>
      <key>URL</key>
      <string>${url}</string>
      <key>IsRemovable</key>
      <true/>
      <key>FullScreen</key>
      <true/>
      <key>Precomposed</key>
      <true/>${iconXml}
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>${title}</string>
  <key>PayloadIdentifier</key>
  <string>${identifier}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuidProfile}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadDescription</key>
  <string>Instalação do aplicativo ${title} na tela inicial do iPhone.</string>
</dict>
</plist>`;
}

export function downloadMobileConfig(options: MobileConfigOptions) {
  const xml = generateMobileConfigXML(options);
  const blob = new Blob([xml], { type: 'application/x-apple-aspen-config;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${options.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.mobileconfig`;
  link.setAttribute('rel', 'external');
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }, 1000);
}

