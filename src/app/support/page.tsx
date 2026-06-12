import { redirect } from 'next/navigation';

export default function SupportIndexPage() {
  redirect('/dashboard?role=support');
}
