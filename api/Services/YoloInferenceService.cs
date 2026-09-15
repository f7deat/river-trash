using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using OpenCvSharp;
using OpenCvSharp.Dnn;
using RiverTrash.Models;
using Size = OpenCvSharp.Size;

namespace RiverTrash.Services;

public interface IYoloInferenceService
{
    DetectionResponse DetectGarbageFromImage(IFormFile imageFile);
}

public class YoloInferenceService : IYoloInferenceService, IDisposable
{
    private readonly InferenceSession _session;
    private readonly string[] _labels = new[] { "Plastic_Bottle", "Plastic_Bag", "Organic_Waste", "Other_Garbage", "PLASTIC_BAG", "PLASTIC_BOTTLE",
    "OTHER_PLASTIC_WASTE", "OTHER_PLASTIC_WASTE",
    "chai_nhua", "beo", "cay_co", "ca_chet", "canh_cay", "tui_rac", "sop"};

    public YoloInferenceService(IHostEnvironment env)
    {
        // Đường dẫn tới file .onnx
        string modelPath = Path.Combine(env.ContentRootPath, "Models", "yolov8_river_waste.onnx");

        // Cấu hình ONNX Session
        var options = new Microsoft.ML.OnnxRuntime.SessionOptions();
        options.AppendExecutionProvider_CPU(); // Nếu có GPU Nvidia thì dùng AppendExecutionProvider_CUDA

        _session = new InferenceSession(modelPath, options);
    }

    public DetectionResponse DetectGarbageFromImage(IFormFile imageFile)
    {
        using var stream = imageFile.OpenReadStream();
        using var mat = Mat.FromStream(stream, ImreadModes.Color);

        // 1. Pre-process: Resize về 640x640 chuẩn YOLO
        using var resizedMat = new Mat();
        Cv2.Resize(mat, resizedMat, new Size(640, 640));

        // 2. Chuyển Mat thành Tensor
        var tensor = ConvertMatToTensor(resizedMat);
        var inputs = new List<NamedOnnxValue>
            {
                NamedOnnxValue.CreateFromTensor("images", tensor)
            };

        // 3. Run Inference
        using var results = _session.Run(inputs);

        // 4. Post-process (Trích xuất Bounding Boxes & Labels từ Tensor output)
        var detectedItems = ParseYoloOutput(results);

        return new DetectionResponse
        {
            Success = true,
            TotalGarbageCount = detectedItems.Count,
            Items = detectedItems
        };
    }

    private Tensor<float> ConvertMatToTensor(Mat mat)
    {
        var tensor = new DenseTensor<float>(new[] { 1, 3, 640, 640 });
        // Mã tiền xử lý: Chuẩn hóa byte 0-255 sang float 0.0-1.0 và ghi vào tensor
        for (int y = 0; y < 640; y++)
        {
            for (int x = 0; x < 640; x++)
            {
                Vec3b color = mat.At<Vec3b>(y, x);
                tensor[0, 0, y, x] = color.Item2 / 255.0f; // R
                tensor[0, 1, y, x] = color.Item1 / 255.0f; // G
                tensor[0, 2, y, x] = color.Item0 / 255.0f; // B
            }
        }
        return tensor;
    }

    private List<DetectedItem> ParseYoloOutput(
    IDisposableReadOnlyCollection<DisposableNamedOnnxValue> results,
    float scoreThreshold = 0.45f,
    float iouThreshold = 0.5f)
    {
        var detectedItems = new List<DetectedItem>();

        // 1. Lấy Tensor Output đầu tiên từ kết quả chạy ONNX Session
        var outputTensor = results.First().Value as Tensor<float>;
        if (outputTensor == null) return detectedItems;

        // Dimensions thông thường: [1, 84, 8400] (Batch Size = 1, Attributes = 84, Boxes = 8400)
        int dimensions = outputTensor.Dimensions[1]; // Số thuộc tính (4 + C)
        int numAnchors = outputTensor.Dimensions[2]; // 8400 ô dự đoán
        int numClasses = dimensions - 4;            // Số lớp (Class Count)

        var boxes = new List<Rect2f>();
        var confidences = new List<float>();
        var classIds = new List<int>();

        // 2. Duyệt qua toàn bộ 8400 ô dự đoán
        for (int i = 0; i < numAnchors; i++)
        {
            // Tìm Class có xác suất cao nhất trong các Class
            float maxScore = 0f;
            int bestClassId = -1;

            for (int c = 0; c < numClasses; c++)
            {
                // Tọa độ truy cập Tensor 3D: [batch, row, col] -> [0, 4 + c, i]
                float score = outputTensor[0, 4 + c, i];
                if (score > maxScore)
                {
                    maxScore = score;
                    bestClassId = c;
                }
            }

            // Lọc bớt các Box có độ tin cậy quá thấp
            if (maxScore >= scoreThreshold)
            {
                // Trích xuất tọa độ Bounding Box (Mặc định ở dạng Center X, Center Y, Width, Height)
                float cx = outputTensor[0, 0, i];
                float cy = outputTensor[0, 1, i];
                float w = outputTensor[0, 2, i];
                float h = outputTensor[0, 3, i];

                // Chuyển đổi từ Center (cx, cy) sang Top-Left (x, y)
                float x = cx - (w / 2.0f);
                float y = cy - (h / 2.0f);

                boxes.Add(new Rect2f(x, y, w, h));
                confidences.Add(maxScore);
                classIds.Add(bestClassId);
            }
        }

        // 3. Sử dụng NMS (Non-Maximum Suppression) từ CvSharp để loại bỏ các khung trùng lặp
        if (boxes.Count > 0)
        {
            CvDnn.NMSBoxes(
                boxes.Select(b => new Rect2d(b.X, b.Y, b.Width, b.Height)),
                confidences,
                scoreThreshold,
                iouThreshold,
                out int[] indices
            );

            // 4. Đóng gói kết quả sau khi đã lọc đè lặp bằng NMS
            foreach (int idx in indices)
            {
                int classId = classIds[idx];
                string labelName = (classId < _labels.Length) ? _labels[classId] : $"Class_{classId}";

                detectedItems.Add(new DetectedItem
                {
                    Label = labelName,
                    Confidence = (float)Math.Round(confidences[idx], 2),
                    Box = new BoundingBox
                    {
                        X = (float)Math.Round(boxes[idx].X, 1),
                        Y = (float)Math.Round(boxes[idx].Y, 1),
                        Width = (float)Math.Round(boxes[idx].Width, 1),
                        Height = (float)Math.Round(boxes[idx].Height, 1)
                    }
                });
            }
        }

        return detectedItems;
    }

    public void Dispose()
    {
        _session?.Dispose();
    }
}