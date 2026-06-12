import { redirect } from 'next/navigation';

export default function MarketerIndexPage() {
  redirect('/dashboard?role=marketer');
}
