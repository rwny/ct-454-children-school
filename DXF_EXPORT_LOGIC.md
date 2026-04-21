# Adding DXF Export Functionality

This document outlines how to add DXF export functionality to a project that previously only supported PNG exports. The new functionality is implemented via two primary Javascript modules, providing two distinct export modes.

The following sections describe the implementation details of these modules, which can be adapted and integrated into a project that uses `three.js` for point cloud visualization.

There are two primary export functions:
1.  **Export Visible View**: Exports only the points currently visible on the screen from a specific orthographic view (Top, Front, or Side).
2.  **Batch Export All Views**: Automatically slices the entire point cloud at regular intervals and exports each slice as a separate DXF file for Top, Front, and Side views.

---

## 1. Export Visible View (`exportViewAsDxf.js`)

This function is designed for exporting a user-defined view of the point cloud. It captures exactly what is visible in the 3D viewport at the moment of export.

### Key Logic:

1.  **View Check**: The export only works if the camera is in an **Orthographic** view (Top, Front, or Side). It will show an alert if the view is perspective or custom.
2.  **Point Collection**:
    *   It traverses all visible point cloud objects in the scene.
    *   For each point, it performs two checks:
        *   **Frustum Culling**: It checks if the point is within the camera's viewing volume (the "frustum").
        *   **Clipping Plane Culling**: It checks if the point is clipped by any active user-defined clipping planes.
    *   A hard limit of `2,000,000` points is set to prevent performance issues in CAD software.
3.  **2D Projection**:
    *   Visible 3D points are projected onto a 2D plane based on the current view:
        *   **Top View**: `(x, y, z)` -> `(x, -z)`
        *   **Front View**: `(x, y, z)` -> `(x, y)`
        *   **Side View**: `(x, y, z)` -> `(-z, y)`
4.  **DXF File Generation**:
    *   The projected 2D points are written into a standard DXF format as `POINT` entities.
    *   The file is given a name that includes the view and point count (e.g., `Top_15032_points.dxf`).
5.  **Download**: The generated DXF file is triggered for download in the browser.

---

## 2. Batch Export All Views (`exportBatchDxf.js`)

This function is an automated process for creating a full set of "drawings" from the point cloud by slicing it at regular intervals.

### Key Logic:

1.  **Environment Detection**: It first checks if the application is running in **Electron** or a standard **Web Browser**, as the file saving mechanism is different.
2.  **User Confirmation**: It calculates the total number of files that will be generated and asks the user for confirmation.
    *   **Electron Mode**: It will prompt the user to select a destination folder where all files will be saved automatically.
    *   **Web Mode**: It warns the user that the browser will trigger a large number of individual download dialogs.
3.  **Slicing and Exporting**:
    *   The function iterates through three view configurations: Top, Front, and Side.
    *   For each view, it "slices" the point cloud from one end to the other in **1.00m steps**.
    *   Each slice has a **thickness of 0.1m** (10cm). For example, a "Top" view slice at `10.00m` will contain all points with a Y-coordinate between `10.00m` and `10.10m`.
    *   All points within a slice are projected to 2D, similar to the single view export.
4.  **File Generation and Saving**:
    *   For each slice that contains points, a DXF file is generated.
    *   The file is named according to its view and level (e.g., `Top_Level_10.00m.dxf`, `Side_Level_5.00m.dxf`).
    *   The file is either saved directly to the chosen folder (Electron) or downloaded via the browser (Web).
