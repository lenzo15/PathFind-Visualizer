using UnityEngine;
using static UnityEngine.EventSystems.PointerEventData;

public class MouseListener : MonoBehaviour
{
    public static InputButton? inputButton = null;
    private void Update()
    {
        if (Input.GetMouseButtonDown(0))
        {
            inputButton = InputButton.Left;
        }
        if (Input.GetMouseButtonUp(0))
        {
            inputButton = null;
        }
        if (Input.GetMouseButtonDown(1))
        {
            inputButton = InputButton.Right;
        }
        if (Input.GetMouseButtonUp(1))
        {
            inputButton = null;
        }
    }
}