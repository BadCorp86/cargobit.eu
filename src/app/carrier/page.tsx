import { redirect } from 'next/navigation';

export default function CarrierIndexPage() {
  redirect('/dashboard?role=carrier');
}
