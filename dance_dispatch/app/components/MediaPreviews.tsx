// components/SoundcloudPlayer.jsx


export const SoundcloudPlayer = ({ embedCode }: { embedCode: string }) => {
    
  return (
    <div 
      // dangerouslySetInnerHTML is used to render the raw HTML string
      dangerouslySetInnerHTML={{ __html: embedCode }} 
    />
  );
}