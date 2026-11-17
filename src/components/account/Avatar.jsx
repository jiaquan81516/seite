import { profileInitials } from '../../lib/account';
export function Avatar({ profile, large = false }) {
  return (
    <span
      className={`profile-avatar avatar-${profile.color.toLowerCase()} ${large ? 'profile-avatar-large' : ''}`}
      aria-hidden="true"
    >
      {profileInitials(profile.name)}
    </span>
  );
}
