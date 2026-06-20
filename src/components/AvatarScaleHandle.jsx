import { useAvatarZoomDrag } from "../hooks/useAvatarZoom";
import "./AvatarScaleHandle.css";

function AvatarScaleHandle({ zoom, setZoom, minZoom, maxZoom, onReset }) {
  const { startDrag } = useAvatarZoomDrag({ zoom, setZoom, minZoom, maxZoom });

  return (
    <div className="avatar-scale-handle" title="Drag to zoom Scotty in or out">
      <button
        type="button"
        className="avatar-scale-handle__line"
        aria-label={`Adjust Scotty zoom, currently ${zoom} percent. Drag up to zoom in, down to zoom out.`}
        onPointerDown={startDrag}
        onDoubleClick={onReset}
      />
      <span className="avatar-scale-handle__hint" aria-hidden="true">
        drag to scale
      </span>
    </div>
  );
}

export default AvatarScaleHandle;
