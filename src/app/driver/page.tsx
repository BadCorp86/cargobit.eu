import { redirect } from 'next/navigation';

export default function DriverIndexPage() {
  redirect('/dashboard?role=driver');
}
