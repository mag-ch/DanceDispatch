type ProfileDetailsProps = {
  bio: string | null;
  genres: string[] | null;
};

export default function ProfileDetails({ bio, genres }: ProfileDetailsProps) {
  if (!bio && !genres?.length) return null;
  return (
    <div className="mt-4 space-y-3">
      {bio && <p className="whitespace-pre-wrap text-sm text-text/80">{bio}</p>}
      {!!genres?.length && (
        <div aria-label="Favorite genres" className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <span key={genre} className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-text">{genre}</span>
          ))}
        </div>
      )}
    </div>
  );
}
