// components/SoundcloudPlayer.jsx

function stripScriptTags(html: string): string {
  if (!html) {
    return '';
  }

  // Prevent React from encountering script nodes in rendered HTML.
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

export const SoundcloudPlayer = ({ embedCode }: { embedCode: string }) => {
  const safeEmbedCode = stripScriptTags(embedCode);
    
  return (
    <div 
      // Render provider embed markup after removing script tags.
      dangerouslySetInnerHTML={{ __html: safeEmbedCode }} 
    />
  );
}