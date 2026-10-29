import Image from "next/image";

export function CharacterPreview() {
  return <div className="min-w-0 overflow-hidden rounded-[12px] border bg-[#f7f8f8]">
    <Image src="/posters/home-mascot.png" alt="Blue mascot wearing glasses and holding a pencil and notebook"
      width={1254} height={1254} preload unoptimized className="h-auto w-full" />
  </div>;
}
