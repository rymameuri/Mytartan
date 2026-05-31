function ScottyMascot({ className = "" }) {
  return (
    <img
      className={className}
      src={`${process.env.PUBLIC_URL}/assets/scotty-mascot.png`}
      alt="Scotty, the CMU mascot"
    />
  );
}

export default ScottyMascot;
