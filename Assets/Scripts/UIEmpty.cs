using UnityEngine;
using UnityEngine.UI;

namespace GameKit.UGUIKit
{
    /// <summary>
    /// 空白图片，不占用Overdraw、不占用DrawCall
    /// 可以用于空白区域响应点击事件
    /// </summary>
    [AddComponentMenu("GameKit/UI/UIEmpty")]
    [RequireComponent(typeof(CanvasRenderer))]
    public class UIEmpty : MaskableGraphic
    {
        // protected UIEmpty()
        // {
        //     // useLegacyMeshGeneration = false;
        // }

        // #if UNITY_EDITOR
        //         protected override void Reset()
        //         {
        //             maskable = false;
        //         }
        // #endif

        protected override void OnPopulateMesh(VertexHelper toFill)
        {
            toFill.Clear();
        }
    }
}