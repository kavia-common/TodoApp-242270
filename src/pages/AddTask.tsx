import type { Category, Task, TaskRecurrence } from "../types/user";
import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AddTaskButton, Container, StyledInput } from "../styles";
import { AddTaskRounded, CancelRounded } from "@mui/icons-material";
import { IconButton, InputAdornment, MenuItem, Tooltip } from "@mui/material";
import { DESCRIPTION_MAX_LENGTH, TASK_NAME_MAX_LENGTH } from "../constants";
import { ColorPicker, TopBar, CustomEmojiPicker } from "../components";
import { UserContext } from "../contexts/UserContext";
import { useStorageState } from "../hooks/useStorageState";
import { useTheme } from "@emotion/react";
import { generateUUID, getFontColor, isDark, showToast } from "../utils";
import { ColorPalette } from "../theme/themeConfig";
import InputThemeProvider from "../contexts/InputThemeProvider";
import { CategorySelect } from "../components/CategorySelect";
import { useToasterStore } from "react-hot-toast";
import { normalizeRecurrence } from "../utils/recurrenceUtils";

const AddTask = () => {
  const { user, setUser } = useContext(UserContext);
  const theme = useTheme();
  const [name, setName] = useStorageState<string>("", "name", "sessionStorage");
  const [emoji, setEmoji] = useStorageState<string | null>(null, "emoji", "sessionStorage");
  const [color, setColor] = useStorageState<string>(theme.primary, "color", "sessionStorage");
  const [description, setDescription] = useStorageState<string>(
    "",
    "description",
    "sessionStorage",
  );
  const [deadline, setDeadline] = useStorageState<string>("", "deadline", "sessionStorage");

  const [recurrenceEnabled, setRecurrenceEnabled] = useStorageState<boolean>(
    false,
    "recurrenceEnabled",
    "sessionStorage",
  );
  const [recurrenceFrequency, setRecurrenceFrequency] = useStorageState<
    TaskRecurrence["frequency"]
  >("daily", "recurrenceFrequency", "sessionStorage");
  const [recurrenceInterval, setRecurrenceInterval] = useStorageState<number>(
    1,
    "recurrenceInterval",
    "sessionStorage",
  );
  const [recurrenceUntil, setRecurrenceUntil] = useStorageState<string>(
    "",
    "recurrenceUntil",
    "sessionStorage",
  );

  const [nameError, setNameError] = useState<string>("");
  const [descriptionError, setDescriptionError] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useStorageState<Category[]>(
    [],
    "categories",
    "sessionStorage",
  );

  const [isDeadlineFocused, setIsDeadlineFocused] = useState<boolean>(false);

  const n = useNavigate();
  const { toasts } = useToasterStore();

  useEffect(() => {
    document.title = "Todo App - Add Task";
  }, []);

  useEffect(() => {
    if (name.length > TASK_NAME_MAX_LENGTH) {
      setNameError(`Name should be less than or equal to ${TASK_NAME_MAX_LENGTH} characters`);
    } else {
      setNameError("");
    }
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      setDescriptionError(
        `Description should be less than or equal to ${DESCRIPTION_MAX_LENGTH} characters`,
      );
    } else {
      setDescriptionError("");
    }
  }, [description.length, name.length]);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    setName(newName);
    if (newName.length > TASK_NAME_MAX_LENGTH) {
      setNameError(`Name should be less than or equal to ${TASK_NAME_MAX_LENGTH} characters`);
    } else {
      setNameError("");
    }
  };

  const handleDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDescription = event.target.value;
    setDescription(newDescription);
    if (newDescription.length > DESCRIPTION_MAX_LENGTH) {
      setDescriptionError(
        `Description should be less than or equal to ${DESCRIPTION_MAX_LENGTH} characters`,
      );
    } else {
      setDescriptionError("");
    }
  };

  const handleDeadlineChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDeadline(event.target.value);
  };

  const handleAddTask = () => {
    if (name === "") {
      showToast("Task name is required.", {
        type: "error",
        id: "task-name-required",
        preventDuplicate: true,
        visibleToasts: toasts,
      });
      return;
    }

    if (nameError !== "" || descriptionError !== "") {
      return; // Do not add the task if the name or description exceeds the maximum length
    }

    const recurrence: TaskRecurrence | undefined = recurrenceEnabled
      ? normalizeRecurrence({
          frequency: recurrenceFrequency,
          interval: Number(recurrenceInterval) || 1,
          until: recurrenceUntil !== "" ? new Date(recurrenceUntil) : undefined,
        })
      : undefined;

    const newTask: Task = {
      id: generateUUID(),
      done: false,
      pinned: false,
      name,
      description: description !== "" ? description : undefined,
      emoji: emoji ? emoji : undefined,
      color,
      date: new Date(),
      deadline: deadline !== "" ? new Date(deadline) : undefined,
      category: selectedCategories ? selectedCategories : [],
      recurrence: recurrenceEnabled ? recurrence : undefined,
      recurrenceState: recurrenceEnabled ? { lastGeneratedYmd: undefined } : undefined,
    };

    setUser((prevUser) => ({
      ...prevUser,
      tasks: [...prevUser.tasks, newTask],
    }));

    n("/");

    showToast(
      <div>
        Added task - <b>{newTask.name}</b>
      </div>,
      {
        icon: <AddTaskRounded />,
      },
    );

    const itemsToRemove = [
      "name",
      "color",
      "description",
      "emoji",
      "deadline",
      "categories",
      "recurrenceEnabled",
      "recurrenceFrequency",
      "recurrenceInterval",
      "recurrenceUntil",
    ];
    itemsToRemove.map((item) => sessionStorage.removeItem(item));
  };

  return (
    <>
      <TopBar title="Add New Task" />
      <Container>
        <CustomEmojiPicker
          emoji={typeof emoji === "string" ? emoji : undefined}
          setEmoji={setEmoji}
          color={color}
          name={name}
          type="task"
        />
        {/* fix for input colors */}
        <InputThemeProvider>
          <StyledInput
            label="Task Name"
            name="name"
            placeholder="Enter task name"
            autoComplete="off"
            value={name}
            onChange={handleNameChange}
            required
            error={nameError !== ""}
            helpercolor={nameError && ColorPalette.red}
            helperText={
              name === ""
                ? undefined
                : !nameError
                  ? `${name.length}/${TASK_NAME_MAX_LENGTH}`
                  : nameError
            }
          />
          <StyledInput
            label="Task Description"
            name="name"
            placeholder="Enter task description"
            autoComplete="off"
            value={description}
            onChange={handleDescriptionChange}
            multiline
            rows={4}
            error={descriptionError !== ""}
            helpercolor={descriptionError && ColorPalette.red}
            helperText={
              description === ""
                ? undefined
                : !descriptionError
                  ? `${description.length}/${DESCRIPTION_MAX_LENGTH}`
                  : descriptionError
            }
          />
          <StyledInput
            label="Task Deadline"
            name="name"
            placeholder="Enter deadline date"
            type="datetime-local"
            value={deadline}
            onChange={handleDeadlineChange}
            onFocus={() => setIsDeadlineFocused(true)}
            onBlur={() => setIsDeadlineFocused(false)}
            hidetext={(!deadline || deadline === "") && !isDeadlineFocused} // fix for label overlapping with input
            sx={{
              colorScheme: isDark(theme.secondary) ? "dark" : "light",
            }}
            slotProps={{
              input: {
                startAdornment:
                  deadline && deadline !== "" ? (
                    <InputAdornment position="start">
                      <Tooltip title="Clear">
                        <IconButton color="error" onClick={() => setDeadline("")}>
                          <CancelRounded />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ) : undefined,
              },
            }}
          />

          <div style={{ marginTop: "6px" }}>
            <StyledInput
              select
              label="Recurring"
              name="recurrenceEnabled"
              value={recurrenceEnabled ? "yes" : "no"}
              onChange={(e) => setRecurrenceEnabled(e.target.value === "yes")}
              helperText="Create a task that repeats on a schedule."
            >
              <MenuItem value="no">No</MenuItem>
              <MenuItem value="yes">Yes</MenuItem>
            </StyledInput>

            {recurrenceEnabled && (
              <>
                <StyledInput
                  select
                  label="Repeat frequency"
                  name="recurrenceFrequency"
                  value={recurrenceFrequency}
                  onChange={(e) =>
                    setRecurrenceFrequency(e.target.value as TaskRecurrence["frequency"])
                  }
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </StyledInput>

                <StyledInput
                  label="Repeat every"
                  name="recurrenceInterval"
                  type="number"
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(Math.max(1, Number(e.target.value) || 1))}
                  slotProps={{
                    input: { inputProps: { min: 1, step: 1 } },
                  }}
                  helperText="Interval (e.g., every 2 weeks)."
                />

                <StyledInput
                  label="Repeat until (optional)"
                  name="recurrenceUntil"
                  type="date"
                  value={recurrenceUntil}
                  onChange={(e) => setRecurrenceUntil(e.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    input: {
                      startAdornment: recurrenceUntil ? (
                        <InputAdornment position="start">
                          <Tooltip title="Clear">
                            <IconButton color="error" onClick={() => setRecurrenceUntil("")}>
                              <CancelRounded />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
              </>
            )}
          </div>

          {user.settings.enableCategories !== undefined && user.settings.enableCategories && (
            <div style={{ marginBottom: "14px" }}>
              <br />
              <CategorySelect
                selectedCategories={selectedCategories}
                onCategoryChange={(categories) => setSelectedCategories(categories)}
                width="400px"
                fontColor={getFontColor(theme.secondary)}
              />
            </div>
          )}
        </InputThemeProvider>
        <ColorPicker
          color={color}
          width="400px"
          onColorChange={(color) => {
            setColor(color);
          }}
          fontColor={getFontColor(theme.secondary)}
        />
        <AddTaskButton
          onClick={handleAddTask}
          disabled={name.length > TASK_NAME_MAX_LENGTH || description.length > DESCRIPTION_MAX_LENGTH}
        >
          Create Task
        </AddTaskButton>
      </Container>
    </>
  );
};

export default AddTask;
