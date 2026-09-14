namespace RiverTrash.Models;

public class BoundingBox
{
    public float X { get; set; }
    public float Y { get; set; }
    public float Width { get; set; }
    public float Height { get; set; }
}

public class DetectedItem
{
    public string Label { get; set; } = string.Empty; // Chai nhựa, Túi nilon, Bèo tây...
    public float Confidence { get; set; }           // Độ tin cậy (VD: 0.92 = 92%)
    public BoundingBox Box { get; set; } = new();
}

public class DetectionResponse
{
    public bool Success { get; set; }
    public int TotalGarbageCount { get; set; }
    public List<DetectedItem> Items { get; set; } = new();
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
