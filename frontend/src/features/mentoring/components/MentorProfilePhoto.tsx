import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MentorDirectoryItem } from '../api/mentorDirectoryApi';
import { mentoringTrainerApi } from '../api/mentoringTrainerApi';
import './MentorProfilePhoto.css';

function mentorInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export function MentorProfilePhoto({ mentor }: { mentor: MentorDirectoryItem }) {
  const pictureQuery = useQuery({
    queryKey: ['mentoring', 'directory-photo', mentor.userId, mentor.profilePictureFileId],
    queryFn: () => {
      if (mentor.profilePictureFileId == null) {
        throw new Error('Mentor profile photo is not available.');
      }
      return mentoringTrainerApi.downloadProfilePicture(mentor.profilePictureFileId);
    },
    enabled: mentor.profilePictureFileId != null,
    staleTime: Infinity,
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pictureQuery.data) {
      setPhotoUrl(null);
      return;
    }

    const url = URL.createObjectURL(pictureQuery.data);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pictureQuery.data]);

  return (
    <div
      className="mentor-profile-photo"
      role="img"
      aria-label={`Profile photo for ${mentor.fullName}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{mentorInitials(mentor.fullName)}</span>
      )}
    </div>
  );
}
