import React from "react";

interface KioskLayoutProps {
  children: React.ReactNode;
}

const KioskLayout = ({ children }: KioskLayoutProps) => {
  return (
    <div className="min-h-screen w-full bg-black text-white">
      <div className="w-full h-full min-h-screen">{children}</div>
    </div>
  );
};

export default KioskLayout;


