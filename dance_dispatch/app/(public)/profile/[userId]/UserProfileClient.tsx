"use client";

import { useEffect, useState } from "react";

type UserProfileClientProps = {
  userId: string;
};

export default function UserProfileClient({ userId }: UserProfileClientProps) {
  const [currentUserId, setCurrentUserId] = useState(userId);

  useEffect(() => {
    setCurrentUserId(userId);
  }, [userId]);

  if (!currentUserId) {
    return <div>Loading...</div>;
  }

  return <div className="min-h-screen bg-gray-50"></div>;
}
