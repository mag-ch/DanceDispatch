import UserProfileClient from "./UserProfileClient";

export default function UserProfilePage({ params }: { params: { userId: string } }) {
  return <UserProfileClient userId={params.userId} />;
}

