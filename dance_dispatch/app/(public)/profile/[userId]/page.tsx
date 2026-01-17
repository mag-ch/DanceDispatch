import { useEffect, useState } from "react";


export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        // Unwrap params promise
        params.then(({ userId }) => setUserId(userId));
    }, [params]);

    if (!userId) return <div>Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50"></div>
    );
}