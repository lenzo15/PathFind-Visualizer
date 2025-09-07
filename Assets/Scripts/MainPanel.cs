using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

public class MainPanel : MonoBehaviour
{
    public static MainPanel Instance { get; private set; }
    [SerializeField] private GameObject mask;
    [SerializeField] private GameObject cellPrefab;
    [SerializeField] private Transform cellContainer;
    [SerializeField] private InputField widthInput;
    [SerializeField] private InputField heightInput;
    [SerializeField] private Button generateButton;
    [SerializeField] private List<PathStrategy> mazeGenStrategies;
    [SerializeField] private Dropdown mazeGenStrategyDropdown;
    [SerializeField] private Button refreshMazeGenStrategyButton;
    [SerializeField] private Button enterButton;
    [SerializeField] private Button exitButton;

    [SerializeField] private PathStrategy clickGenEnterStrategy;
    [SerializeField] private PathStrategy clickGenExitStrategy;

    private List<Cell> allCells = new List<Cell>();
    private StrategyManager strategyManager;
    private List<Cell> cells;
    private RectTransform cellContainerRectTransform;
    private GridLayoutGroup gridLayoutGroup;
    private PathStrategy mazeGenStrategy;
    private float scale;
    private float gridSpace;

    private void Awake()
    {
        Instance = this;
        strategyManager = new StrategyManager();
        cells = strategyManager.cells;
        cellContainerRectTransform = cellContainer.GetComponent<RectTransform>();
        gridLayoutGroup = cellContainer.GetComponent<GridLayoutGroup>();
        scale = cellContainerRectTransform.localScale.x;
        gridSpace = gridLayoutGroup.spacing.x;
        cellContainer.gameObject.SetActive(false);
        generateButton.onClick.AddListener(OnClickGenGrid);
        enterButton.onClick.AddListener(OnClickEnter);
        exitButton.onClick.AddListener(OnClickExit);
        mazeGenStrategyDropdown.onValueChanged.AddListener(OnChangeMazeGenStrategy);
        refreshMazeGenStrategyButton.onClick.AddListener(() => OnChangeMazeGenStrategy(mazeGenStrategyDropdown.value));
        mask.SetActive(false);
    }
    // Start is called before the first frame update
    void Start()
    {
        GenerateGrid(StrategyManager.Instance.width, StrategyManager.Instance.height);
        RefreshMazeGenStrategy();
    }

    public void Update()
    {
        if (cells != null && cells.Count > 0)
        {
            var scrollDelta = Input.mouseScrollDelta.y;
            if (!Mathf.Approximately(scrollDelta, 0))
            {
                ScaleGrid(scale + scrollDelta * 0.1f);
            }
        }
    }

    private void ScaleGrid(float scale)
    {
        scale = Mathf.Clamp(scale, 0.2f, 3);
        this.scale = scale;
        cellContainerRectTransform.localScale = new Vector3(scale, scale, scale);
        var newGridSpace = Mathf.Clamp(gridSpace / scale, 1, 10);
        gridLayoutGroup.spacing = new Vector2(newGridSpace, newGridSpace);
        RefreshGridSize(StrategyManager.Instance.width, StrategyManager.Instance.height);
    }

    public void GenerateGrid(int width, int height)
    {
        StrategyManager.Instance.width = width;
        StrategyManager.Instance.height = height;
        int cellCount = width * height;
        cells.Clear();
        if (cellCount > allCells.Count)
        {
            for (int i = allCells.Count; i < cellCount; i++)
            {
                GameObject cellGo = GameObject.Instantiate(cellPrefab, cellContainer);
                var cell = cellGo.GetComponent<Cell>();
                allCells.Add(cell);
            }
        }
        for (int i = 0; i < allCells.Count; i++)
        {
            allCells[i].gameObject.SetActive(i < cellCount);
            cells.Add(allCells[i]);
            InitCell(allCells[i], i % width, i / width);
        }
        StrategyManager.Instance?.InitCells();
        RefreshGridSize(width, height);
        cellContainer.gameObject.SetActive(true);
    }

    public void ShowMask(bool show)
    {
        mask.SetActive(show);
    }

    private void RefreshGridSize(int width, int height)
    {
        cellContainerRectTransform.sizeDelta = new Vector2(
            gridLayoutGroup.cellSize.x * width + gridLayoutGroup.spacing.x * width + gridLayoutGroup.padding.left + gridLayoutGroup.padding.right,
            gridLayoutGroup.cellSize.y * height + gridLayoutGroup.spacing.y * height + gridLayoutGroup.padding.top + gridLayoutGroup.padding.bottom);
    }

    private void OnClickGenGrid()
    {
        var width = int.Parse(widthInput.text);
        var height = int.Parse(heightInput.text);
        GenerateGrid(width, height);
    }

    private void OnClickEnter()
    {
        StrategyManager.Instance.ApplyStrategy(clickGenEnterStrategy);
    }

    private void OnClickExit()
    {
        StrategyManager.Instance.ApplyStrategy(clickGenExitStrategy);
    }

    private void InitCell(Cell cell, int x, int y)
    {
        cell.x = x;
        cell.y = y;
    }

    private void RefreshMazeGenStrategy()
    {
        mazeGenStrategyDropdown.options.Clear();
        foreach (var strategy in mazeGenStrategies)
        {
            mazeGenStrategyDropdown.options.Add(new Dropdown.OptionData(strategy.Name()));
        }
        mazeGenStrategyDropdown.value = 0;
        mazeGenStrategyDropdown.RefreshShownValue();
        OnChangeMazeGenStrategy(0);
    }

    private void OnChangeMazeGenStrategy(int index)
    {
        if (mazeGenStrategy != null)
        {
            mazeGenStrategy.Destroy();
        }
        mazeGenStrategy = mazeGenStrategies[index];
        StrategyManager.Instance.ApplyStrategy(mazeGenStrategy);
    }
}
